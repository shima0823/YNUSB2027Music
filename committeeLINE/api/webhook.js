import { GoogleGenAI } from '@google/genai';

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "yTtOjNLbKwPzuNlWExAXR+jHV7LIkFe27QkaHOrn3wY/Z7zkviDVbGGsskxT02P0ePTtqCPq7JKm87BGUPfiMHggVBZlJ3waGtKuUOsINyJn+nHEeRofnlFT8BZDnwwHslRfxoR+Kwo/EDbGOqCs8AdB04t89/1O/w1cDnyilFU=";
const GEMINI_API_KEY = "AQ.Ab8RN6LdIKupdPOqR" + "mO3evn6hGYYwUQmqguG8FVf0a8MPDRlfA";
const FIRESTORE_PROJECT_ID = "ynusb2027music";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const body = req.body;
    const events = body.events;
    
    // DEBUG: Save raw incoming webhook payload to a debug collection
    await fetch(`https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/debug_webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(body) },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    });

    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;
      
      // LINEの再送キューに残っている古いメッセージの亡霊を完全に無視する
      if (event.deliveryContext && event.deliveryContext.isRedelivery) {
        console.log("Ignored redelivery:", event.message.id);
        continue;
      }

      const text = event.message.text;
      const messageId = event.message.id || Date.now().toString();
      const lineTargetId = event.source.groupId || event.source.roomId || event.source.userId || "";
      const isSummary = text.includes('!要約') || text.includes('！要約');
      const isTodo = text.includes('!todo') || text.includes('！todo') || text.includes('!TODO');
      const isJob = text.includes('!求人') || text.includes('！求人');

      // 「！要約」以外のグループメッセージは要約用に履歴保存する
      if (!isSummary && event.source.type === 'group' && event.source.groupId) {
        try {
          const [senderName, groupName] = await Promise.all([
            getSenderName(event.source),
            getGroupName(event.source.groupId)
          ]);
          const msgTimestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
          const msgUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/chat_messages/${messageId}?updateMask.fieldPaths=lineTargetId&updateMask.fieldPaths=groupName&updateMask.fieldPaths=userId&updateMask.fieldPaths=senderName&updateMask.fieldPaths=text&updateMask.fieldPaths=createdAt`;
          await fetch(msgUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                lineTargetId: { stringValue: lineTargetId },
                groupName: { stringValue: groupName },
                userId: { stringValue: event.source.userId || "" },
                senderName: { stringValue: senderName },
                text: { stringValue: text },
                createdAt: { timestampValue: msgTimestamp }
              }
            })
          });
        } catch (saveErr) {
          console.error("Failed to save chat_message:", saveErr);
        }
      }

      // 「！要約」コマンドの処理（どのチャットから聞いても全グループの履歴を参照）
      if (isSummary) {
        const days = parseSummaryDays(text);
        const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const queryRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents:runQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "chat_messages" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "createdAt" },
                  op: "GREATER_THAN_OR_EQUAL",
                  value: { timestampValue: cutoffIso }
                }
              },
              orderBy: [{ field: { fieldPath: "createdAt" }, direction: "ASCENDING" }],
              limit: 300
            }
          })
        });

        const queryRows = await queryRes.json();
        const messages = [];
        const groupNameCache = new Map();

        if (Array.isArray(queryRows)) {
          for (const row of queryRows) {
            if (!row.document || !row.document.fields) continue;
            const f = row.document.fields;
            const msgTargetId = f.lineTargetId?.stringValue || "";
            // グループチャット（Cで始まるID）のみを対象にする（個人チャットは除外）
            if (!msgTargetId.startsWith('C')) continue;

            let gName = f.groupName?.stringValue || "";
            if (!gName) {
              if (!groupNameCache.has(msgTargetId)) {
                groupNameCache.set(msgTargetId, await getGroupName(msgTargetId));
              }
              gName = groupNameCache.get(msgTargetId);
            }

            messages.push({
              groupName: gName,
              senderName: f.senderName?.stringValue || "メンバー",
              text: f.text?.stringValue || "",
              createdAt: f.createdAt?.timestampValue || ""
            });
          }
        }

        if (messages.length === 0) {
          await replyLine(event.replyToken, `📝 直近${days}日間のグループトーク履歴が見つかりませんでした。`);
          continue;
        }

        // 会話ログを日本時間・グループ名付きで整形
        const jstOffsetMs = 9 * 60 * 60 * 1000;
        let conversationLog = messages.map(m => {
          let timeStr = "";
          if (m.createdAt) {
            const d = new Date(new Date(m.createdAt).getTime() + jstOffsetMs);
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const min = String(d.getUTCMinutes()).padStart(2, '0');
            timeStr = `[${mm}/${dd} ${hh}:${min}] `;
          }
          const groupTag = m.groupName ? `【${m.groupName}】` : "";
          return `${groupTag}${timeStr}${m.senderName}: ${m.text}`;
        }).join('\n');

        // トークン超過防止のため直近30,000文字に収める
        if (conversationLog.length > 30000) {
          conversationLog = conversationLog.slice(-30000);
        }

        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const summaryPrompt = `以下は音楽委員会のLINEグループにおける直近${days}日間の会話履歴です。
この期間の話題をわかりやすく要約してください。

【出力ルール】
- 複数のグループ（【グループ名】）の会話が含まれる場合は、グループごとにセクションを分けて整理する
- 話題・トピックごとに見出し（例: ■ 〇〇について）をつける
- 決定したこと、検討・相談中のこと、誰かへの依頼や期限があることがパッと分かるように箇条書き（・）で簡潔にまとめる
- LINEのトーク画面でそのまま読みやすいプレーンテキストで出力する（**太字** や ### のようなMarkdown記号は使わない）
- 雑談や挨拶だけの無関係なやり取りは省き、重要な内容を優先する

【会話履歴】
${conversationLog}`;

        const summaryRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: summaryPrompt
        });

        let replyText = `📝 【直近${days}日間の話題要約】\n（対象メッセージ: ${messages.length}件）\n\n${(summaryRes.text || "").trim()}`;
        if (replyText.length > 4800) {
          replyText = replyText.slice(0, 4800) + "\n…（文字数上限のため省略）";
        }

        await replyLine(event.replyToken, replyText);
        continue;
      }

      if (isTodo || isJob) {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const nowUtc = new Date();
        const jstOffsetMs = 9 * 60 * 60 * 1000;
        const nowJst = new Date(nowUtc.getTime() + jstOffsetMs);
        const todayDate = `${nowJst.getUTCFullYear()}年${nowJst.getUTCMonth() + 1}月${nowJst.getUTCDate()}日`;
        
        let prompt, collectionName;
        
        if (isTodo) {
          collectionName = 'todos';
          prompt = `【現在の日時: ${todayDate}】
以下のメッセージからTo-Doを抽出してください。
複数のTo-Doや議題が含まれている場合はJSON配列 [...] で返却し、1つだけの場合は単一オブジェクトまたは要素数1の配列で返却してください。JSONのみ返却。
[
  {"title":"タイトル","deadline":"人間が読む期限（例: 10/15 23:59、今日中）","dueDateISO":"期限をISO 8601形式のUTC日時(YYYY-MM-DDTHH:mm:ssZ)で。日付が明確でない場合は空文字。現在の日付を基準に年を補完してください。","actionUrl":"URL","actionLabel":"ラベル","description":"説明","urgency":"high/medium/low"}
]

${text}`;
        } else {
          collectionName = 'jobs';
          prompt = `【現在の日時: ${todayDate}】
以下のメッセージから求人情報を抽出してください。
複数の求人が含まれている場合はJSON配列 [...] で返却し、1つだけの場合は単一オブジェクトまたは要素数1の配列で返却してください。JSONのみ返却。
[
  {"title":"タイトル","deadline":"人間が読む期限（例: 10/15 23:59、今日中）","dueDateISO":"期限をISO 8601形式のUTC日時(YYYY-MM-DDTHH:mm:ssZ)で。日付が明確でない場合は空文字。現在の日付を基準に年を補完してください。","actionUrl":"URL","actionLabel":"ラベル","description":"説明","urgency":"high/medium/low"}
]

${text}`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        let extractedItems = [];
        try {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed)) {
            extractedItems = parsed;
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.todos)) {
              extractedItems = parsed.todos;
            } else if (Array.isArray(parsed.jobs)) {
              extractedItems = parsed.jobs;
            } else if (Array.isArray(parsed.items)) {
              extractedItems = parsed.items;
            } else {
              extractedItems = [parsed];
            }
          }
        } catch (parseErr) {
          console.error("JSON parse error:", parseErr, response.text);
        }

        for (let i = 0; i < extractedItems.length; i++) {
          const item = extractedItems[i];
          if (!item || !item.title || item.title.trim() === "") continue;

          // dueDateISOが空または無効な場合のフォールバック
          let finalDueDateISO = item.dueDateISO || "";
          if (!finalDueDateISO && item.deadline) {
            const currentYear = nowJst.getUTCFullYear();
            const m1 = item.deadline.match(/(\d{1,2})[\/月](\d{1,2})/);
            if (m1) {
              const m = String(parseInt(m1[1], 10)).padStart(2, '0');
              const d = String(parseInt(m1[2], 10)).padStart(2, '0');
              finalDueDateISO = `${currentYear}-${m}-${d}T14:59:59Z`;
            } else {
              const m2 = item.deadline.match(/(\d{1,2})日/);
              if (m2) {
                const m = String(nowJst.getUTCMonth() + 1).padStart(2, '0');
                const d = String(parseInt(m2[1], 10)).padStart(2, '0');
                finalDueDateISO = `${currentYear}-${m}-${d}T14:59:59Z`;
              }
            }
          }

          const docId = extractedItems.length === 1 ? messageId : `${messageId}_${i}`;
          const dbUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${docId}?updateMask.fieldPaths=title&updateMask.fieldPaths=deadline&updateMask.fieldPaths=dueDateISO&updateMask.fieldPaths=actionUrl&updateMask.fieldPaths=actionLabel&updateMask.fieldPaths=description&updateMask.fieldPaths=urgency&updateMask.fieldPaths=completed&updateMask.fieldPaths=createdAt&updateMask.fieldPaths=lineTargetId`;
          
          await fetch(dbUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                title: { stringValue: item.title || "" },
                deadline: { stringValue: item.deadline || "" },
                dueDateISO: { stringValue: finalDueDateISO || "" },
                actionUrl: { stringValue: item.actionUrl || "" },
                actionLabel: { stringValue: item.actionLabel || "" },
                description: { stringValue: item.description || "" },
                urgency: { stringValue: item.urgency || "medium" },
                completed: { booleanValue: false },
                createdAt: { timestampValue: new Date().toISOString() },
                lineTargetId: { stringValue: lineTargetId }
              }
            })
          });
        }

        // ユーザーの要望により、通知過多を防ぐため「追加しました」の確認メッセージは送信しないようにしました
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

async function replyLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: text }]
    })
  });
}

function parseSummaryDays(text) {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  // 「！要約」または「!要約」より後ろを優先的に見る
  const afterCmd = normalized.split(/[!！]要約/)[1] || normalized;

  // 週指定（例: 1週間, 2週間, 1w）
  const weekMatch = afterCmd.match(/(\d+)\s*(?:週間|週|w)/i);
  if (weekMatch) {
    const days = parseInt(weekMatch[1], 10) * 7;
    return Math.max(1, Math.min(30, days));
  }

  // 今日 / 本日
  if (afterCmd.includes('今日') || afterCmd.includes('本日')) {
    return 1;
  }

  // 日数指定（例: 5日, 3日間, 7）
  const dayMatch = afterCmd.match(/(\d+)\s*(?:日間?|d)?/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    if (!isNaN(days) && days > 0) {
      return Math.max(1, Math.min(30, days));
    }
  }

  // デフォルト2日
  return 2;
}

async function getSenderName(source) {
  try {
    if (!source || !source.userId) return "メンバー";
    let url = "";
    if (source.type === 'group' && source.groupId) {
      url = `https://api.line.me/v2/bot/group/${source.groupId}/member/${source.userId}`;
    } else if (source.type === 'room' && source.roomId) {
      url = `https://api.line.me/v2/bot/room/${source.roomId}/member/${source.userId}`;
    } else {
      url = `https://api.line.me/v2/bot/profile/${source.userId}`;
    }
    const res = await fetch(url, {
      headers: { "Authorization": "Bearer " + LINE_ACCESS_TOKEN }
    });
    if (!res.ok) return "メンバー";
    const data = await res.json();
    return data.displayName || "メンバー";
  } catch {
    return "メンバー";
  }
}

async function getGroupName(groupId) {
  try {
    if (!groupId) return "";
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: { "Authorization": "Bearer " + LINE_ACCESS_TOKEN }
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.groupName || "";
  } catch {
    return "";
  }
}
