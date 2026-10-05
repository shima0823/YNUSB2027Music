const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "yTtOjNLbKwPzuNlWExAXR+jHV7LIkFe27QkaHOrn3wY/Z7zkviDVbGGsskxT02P0ePTtqCPq7JKm87BGUPfiMHggVBZlJ3waGtKuUOsINyJn+nHEeRofnlFT8BZDnwwHslRfxoR+Kwo/EDbGOqCs8AdB04t89/1O/w1cDnyilFU=";
const FIRESTORE_PROJECT_ID = "ynusb2027music";

export default async function handler(req, res) {
  try {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    const collections = ['todos', 'jobs'];
    let remindersSent = 0;

    for (const col of collections) {
      const dbUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${col}`;
      const response = await fetch(dbUrl);
      const data = await response.json();

      if (!data.documents) continue;

      for (const doc of data.documents) {
        const fields = doc.fields;
        if (!fields.completed || fields.completed.booleanValue === true) continue;
        
        const dueDateISO = fields.dueDateISO?.stringValue;
        const lineTargetId = fields.lineTargetId?.stringValue;

        if (dueDateISO && lineTargetId) {
          if (dueDateISO.startsWith(tomorrowStr)) {
            // Send reminder
            const typeLabel = col === 'todos' ? "To-Do" : "求人";
            const title = fields.title?.stringValue || "無題";
            const deadline = fields.deadline?.stringValue || "明日";
            
            const messageText = `⚠️ 【期限前日リマインド】\n明日は以下の${typeLabel}の期限です！忘れずに対応をお願いします！\n\n「${title}」\n(期限: ${deadline})\n\nダッシュボードで確認: https://ynusb-2027-music.vercel.app/`;
            
            await fetch("https://api.line.me/v2/bot/message/push", {
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
            remindersSent++;
          }
        }
      }
    }

    res.status(200).json({ success: true, remindersSent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
