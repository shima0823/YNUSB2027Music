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
      const isTodo = text.includes('!todo') || text.includes('！todo') || text.includes('!TODO');
      const isJob = text.includes('!求人') || text.includes('！求人');

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
以下のメッセージからTo-Doを抽出してください。JSONのみ返却。
{"title":"タイトル","deadline":"人間が読む期限（例: 10/15 23:59、今日中）","dueDateISO":"期限をISO 8601形式のUTC日時(YYYY-MM-DDTHH:mm:ssZ)で。日付が明確でない場合は空文字。現在の日付を基準に年を補完してください。","actionUrl":"URL","actionLabel":"ラベル","description":"説明","urgency":"high/medium/low"}

${text}`;
        } else {
          collectionName = 'jobs';
          prompt = `【現在の日時: ${todayDate}】
以下のメッセージから求人情報を抽出してください。JSONのみ返却。
{"title":"タイトル","deadline":"人間が読む期限（例: 10/15 23:59、今日中）","dueDateISO":"期限をISO 8601形式のUTC日時(YYYY-MM-DDTHH:mm:ssZ)で。日付が明確でない場合は空文字。現在の日付を基準に年を補完してください。","actionUrl":"URL","actionLabel":"ラベル","description":"説明","urgency":"high/medium/low"}

${text}`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const extractedData = JSON.parse(response.text);
        
        // dueDateISOが空または無効な場合のフォールバック
        let finalDueDateISO = extractedData.dueDateISO || "";
        if (!finalDueDateISO && extractedData.deadline) {
          const currentYear = nowJst.getUTCFullYear();
          const m1 = extractedData.deadline.match(/(\d{1,2})[\/月](\d{1,2})/);
          if (m1) {
            const m = String(parseInt(m1[1], 10)).padStart(2, '0');
            const d = String(parseInt(m1[2], 10)).padStart(2, '0');
            finalDueDateISO = `${currentYear}-${m}-${d}T14:59:59Z`;
          } else {
            const m2 = extractedData.deadline.match(/(\d{1,2})日/);
            if (m2) {
              const m = String(nowJst.getUTCMonth() + 1).padStart(2, '0');
              const d = String(parseInt(m2[1], 10)).padStart(2, '0');
              finalDueDateISO = `${currentYear}-${m}-${d}T14:59:59Z`;
            }
          }
        }

        const messageId = event.message.id || Date.now().toString();
        const lineTargetId = event.source.groupId || event.source.userId || "";
        const dbUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${messageId}?updateMask.fieldPaths=title&updateMask.fieldPaths=deadline&updateMask.fieldPaths=dueDateISO&updateMask.fieldPaths=actionUrl&updateMask.fieldPaths=actionLabel&updateMask.fieldPaths=description&updateMask.fieldPaths=urgency&updateMask.fieldPaths=completed&updateMask.fieldPaths=createdAt&updateMask.fieldPaths=lineTargetId`;
        
        await fetch(dbUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              title: { stringValue: extractedData.title || "" },
              deadline: { stringValue: extractedData.deadline || "" },
              dueDateISO: { stringValue: finalDueDateISO || "" },
              actionUrl: { stringValue: extractedData.actionUrl || "" },
              actionLabel: { stringValue: extractedData.actionLabel || "" },
              description: { stringValue: extractedData.description || "" },
              urgency: { stringValue: extractedData.urgency || "medium" },
              completed: { booleanValue: false },
              createdAt: { timestampValue: new Date().toISOString() },
              lineTargetId: { stringValue: lineTargetId }
            }
          })
        });

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
