const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "yTtOjNLbKwPzuNlWExAXR+jHV7LIkFe27QkaHOrn3wY/Z7zkviDVbGGsskxT02P0ePTtqCPq7JKm87BGUPfiMHggVBZlJ3waGtKuUOsINyJn+nHEeRofnlFT8BZDnwwHslRfxoR+Kwo/EDbGOqCs8AdB04t89/1O/w1cDnyilFU=";
const FIRESTORE_PROJECT_ID = "ynusb2027music";

function parseDateFallback(deadlineStr, nowJst) {
  if (!deadlineStr) return null;
  const currentYear = nowJst.getUTCFullYear();
  
  // パターン1: M月D日 または M/D (例: "10/16(金)まで", "10月20日 23:59")
  const m1 = deadlineStr.match(/(\d{1,2})[\/月](\d{1,2})/);
  if (m1) {
    const month = String(parseInt(m1[1], 10)).padStart(2, '0');
    const day = String(parseInt(m1[2], 10)).padStart(2, '0');
    return `${currentYear}-${month}-${day}`;
  }
  
  // パターン2: D日 (月がない場合、現在の月とする。例: "13日 21:00")
  const m2 = deadlineStr.match(/(\d{1,2})日/);
  if (m2) {
    const month = String(nowJst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parseInt(m2[1], 10)).padStart(2, '0');
    return `${currentYear}-${month}-${day}`;
  }
  
  return null;
}

export default async function handler(req, res) {
  const executionLogs = [];
  try {
    const nowUtc = new Date();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const nowJst = new Date(nowUtc.getTime() + jstOffsetMs);
    const tomorrowJst = new Date(nowUtc.getTime() + jstOffsetMs + (24 * 60 * 60 * 1000));
    
    const todayJstStr = nowJst.toISOString().split('T')[0];
    const tomorrowJstStr = tomorrowJst.toISOString().split('T')[0];

    const collections = ['todos', 'jobs'];
    let remindersSent = 0;

    for (const col of collections) {
      const dbUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${col}`;
      const response = await fetch(dbUrl);
      const data = await response.json();

      if (!data.documents) continue;

      for (const doc of data.documents) {
        const docId = doc.name.split('/').pop();
        const fields = doc.fields;
        
        // 完了済みはスキップ
        if (fields.completed && fields.completed.booleanValue === true) {
          continue;
        }

        const title = fields.title?.stringValue || "無題";
        const deadline = fields.deadline?.stringValue || "";
        const lineTargetId = fields.lineTargetId?.stringValue;
        const alreadyReminded = fields.remindedAt?.timestampValue || null;

        // 締め切り日（JSTのYYYY-MM-DD）の算出
        let targetDueDateStr = null;
        const rawDueDateISO = fields.dueDateISO?.stringValue;

        if (rawDueDateISO) {
          const parsed = new Date(rawDueDateISO);
          if (!isNaN(parsed.getTime())) {
            const parsedJst = new Date(parsed.getTime() + jstOffsetMs);
            const parsedYear = parsedJst.getUTCFullYear();
            // 過去年（例: 2024など）に誤認識されている場合はフォールバック
            if (parsedYear >= nowJst.getUTCFullYear()) {
              targetDueDateStr = parsedJst.toISOString().split('T')[0];
            }
          }
        }

        // dueDateISOから取得できなかった場合は自然言語deadlineから算出
        if (!targetDueDateStr && deadline) {
          targetDueDateStr = parseDateFallback(deadline, nowJst);
        }

        const logEntry = {
          docId,
          title,
          deadline,
          rawDueDateISO: rawDueDateISO || "",
          targetDueDateStr,
          tomorrowJstStr,
          isMatch: targetDueDateStr === tomorrowJstStr,
          alreadyReminded: !!alreadyReminded
        };

        if (targetDueDateStr === tomorrowJstStr && lineTargetId && !alreadyReminded) {
          const typeLabel = col === 'todos' ? "To-Do" : "求人";
          const messageText = `⚠️ 【期限前日リマインド】\n明日は以下の${typeLabel}の期限です！忘れずに対応をお願いします！\n\n「${title}」\n(期限: ${deadline})\n\nダッシュボードで確認: https://ynusb-2027-music.vercel.app/`;

          const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + LINE_ACCESS_TOKEN
            },
            body: JSON.stringify({
              to: lineTargetId,
              messages: [{ type: "text", text: messageText }]
            })
          });

          if (lineRes.ok) {
            remindersSent++;
            logEntry.sent = true;

            // 二重送信防止用フラグと補正したdueDateISOを保存
            const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${col}/${docId}?updateMask.fieldPaths=remindedAt&updateMask.fieldPaths=dueDateISO`;
            await fetch(patchUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  remindedAt: { timestampValue: nowUtc.toISOString() },
                  dueDateISO: { stringValue: `${targetDueDateStr}T14:59:59Z` }
                }
              })
            });
          } else {
            const errText = await lineRes.text();
            logEntry.error = errText;
          }
        }

        executionLogs.push(logEntry);
      }
    }

    // 実行ログをFirestoreに保存（動作確認・デバッグ用）
    const logUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/cron_logs`;
    await fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          executedAtJST: { stringValue: nowJst.toISOString() },
          todayJstStr: { stringValue: todayJstStr },
          tomorrowJstStr: { stringValue: tomorrowJstStr },
          remindersSent: { integerValue: remindersSent.toString() },
          logsJson: { stringValue: JSON.stringify(executionLogs) }
        }
      })
    });

    res.status(200).json({ success: true, todayJstStr, tomorrowJstStr, remindersSent, executionLogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, executionLogs });
  }
}
