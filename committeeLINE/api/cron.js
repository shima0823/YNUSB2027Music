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
    const oneDayMs = 24 * 60 * 60 * 1000;
    const nowJst = new Date(nowUtc.getTime() + jstOffsetMs);
    const tomorrowJst = new Date(nowUtc.getTime() + jstOffsetMs + oneDayMs);
    const dayAfterTomorrowJst = new Date(nowUtc.getTime() + jstOffsetMs + (2 * oneDayMs));
    
    const todayJstStr = nowJst.toISOString().split('T')[0];
    const tomorrowJstStr = tomorrowJst.toISOString().split('T')[0];
    const dayAfterTomorrowJstStr = dayAfterTomorrowJst.toISOString().split('T')[0];

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

        const title = fields.title?.stringValue || "";
        if (!title.trim()) continue;

        const deadline = fields.deadline?.stringValue || "";
        const lineTargetId = fields.lineTargetId?.stringValue;
        const lastRemindedDate = fields.lastRemindedDate?.stringValue || null;
        const alreadyRemindedToday = lastRemindedDate === todayJstStr;

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

        // リマインドタイミング判定（前々日 / 前日 / 当日）
        let reminderTiming = null;
        if (targetDueDateStr === dayAfterTomorrowJstStr) {
          reminderTiming = '2days_before';
        } else if (targetDueDateStr === tomorrowJstStr) {
          reminderTiming = '1day_before';
        } else if (targetDueDateStr === todayJstStr) {
          reminderTiming = 'today';
        }

        const logEntry = {
          docId,
          title,
          deadline,
          rawDueDateISO: rawDueDateISO || "",
          targetDueDateStr,
          reminderTiming,
          alreadyRemindedToday
        };

        if (reminderTiming && lineTargetId && !alreadyRemindedToday) {
          const typeLabel = col === 'todos' ? "To-Do" : "求人";
          let headerText = "";
          if (reminderTiming === '2days_before') {
            headerText = `⏰ 【期限2日前リマインド】\n明後日（2日後）は以下の${typeLabel}の期限です！計画的に進めましょう！`;
          } else if (reminderTiming === '1day_before') {
            headerText = `⚠️ 【期限前日リマインド】\n明日は以下の${typeLabel}の期限です！忘れずに対応をお願いします！`;
          } else {
            headerText = `🚨 【本日が期限！】\n今日が以下の${typeLabel}の締め切り日です！未対応の方は本日中にお願いします！`;
          }

          const messageText = `${headerText}\n\n「${title}」\n(期限: ${deadline})\n\nダッシュボードで確認: https://ynusb-2027-music.vercel.app/`;

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

            // 同日二重送信防止用の日付と補正したdueDateISOを保存
            const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${col}/${docId}?updateMask.fieldPaths=remindedAt&updateMask.fieldPaths=lastRemindedDate&updateMask.fieldPaths=dueDateISO`;
            await fetch(patchUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  remindedAt: { timestampValue: nowUtc.toISOString() },
                  lastRemindedDate: { stringValue: todayJstStr },
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
          dayAfterTomorrowJstStr: { stringValue: dayAfterTomorrowJstStr },
          remindersSent: { integerValue: remindersSent.toString() },
          logsJson: { stringValue: JSON.stringify(executionLogs) }
        }
      })
    });

    res.status(200).json({ success: true, todayJstStr, tomorrowJstStr, dayAfterTomorrowJstStr, remindersSent, executionLogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, executionLogs });
  }
}
