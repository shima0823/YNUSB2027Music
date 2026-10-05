import { GoogleGenAI } from '@google/genai';

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "yTtOjNLbKwPzuNlWExAXR+jHV7LIkFe27QkaHOrn3wY/Z7zkviDVbGGsskxT02P0ePTtqCPq7JKm87BGUPfiMHggVBZlJ3waGtKuUOsINyJn+nHEeRofnlFT8BZDnwwHslRfxoR+Kwo/EDbGOqCs8AdB04t89/1O/w1cDnyilFU=";
const GEMINI_API_KEY = "AQ.Ab8RN6LdIKupdPOqR" + "mO3evn6hGYYwUQmqguG8FVf0a8MPDRlfA";
const FIRESTORE_PROJECT_ID = "ynusb2027music";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text = event.message.text;
      const isTodo = text.includes('!todo') || text.includes('！todo') || text.includes('!TODO');
      const isJob = text.includes('!求人') || text.includes('！求人');

      if (isTodo || isJob) {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        
        let prompt, collectionName;
        
        if (isTodo) {
          collectionName = 'todos';
          prompt = `
以下のメッセージから、To-Do（やるべきこと）を抽出してください。
以下のJSONフォーマットのみを返してください。

{
  "title": "タスクの短いタイトル",
  "deadline": "提出期限（例: 10/15 23:59、今日中、など）",
  "actionUrl": "メッセージ内にURLがあればそれ。なければ空文字",
  "actionLabel": "リンクを開くボタンのラベル（例: フォームを開く、スプシを開く）",
  "description": "タスクの簡単な説明（1行）",
  "urgency": "high または medium または low"
}

メッセージ：
${text}
`;
        } else {
          collectionName = 'jobs';
          prompt = `
以下のメッセージから、求人・募集情報（募集している役職や役割）を抽出してください。
以下のJSONフォーマットのみを返してください。

{
  "title": "募集している役職や役割の短いタイトル",
  "deadline": "募集期限（例: 今週金曜まで、決まり次第終了、など）",
  "actionUrl": "応募フォームなどのURLがあればそれ。なければ空文字",
  "actionLabel": "リンクを開くボタンのラベル（例: 応募する、詳細を見る）",
  "description": "仕事の概要やアピールポイント、条件など（1〜2行）",
  "urgency": "high または medium または low"
}

メッセージ：
${text}
`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        const extractedData = JSON.parse(response.text);

        // Firestoreに保存 (messageIdをドキュメントIDにして重複作成を完全に防ぐ)
        const messageId = event.message.id || Date.now().toString();
        const dbUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${messageId}?updateMask.fieldPaths=title&updateMask.fieldPaths=deadline&updateMask.fieldPaths=actionUrl&updateMask.fieldPaths=actionLabel&updateMask.fieldPaths=description&updateMask.fieldPaths=urgency&updateMask.fieldPaths=completed&updateMask.fieldPaths=createdAt`;
        
        const firestoreDoc = {
          fields: {
            title: { stringValue: extractedData.title || "" },
            deadline: { stringValue: extractedData.deadline || "" },
            actionUrl: { stringValue: extractedData.actionUrl || "" },
            actionLabel: { stringValue: extractedData.actionLabel || "" },
            description: { stringValue: extractedData.description || "" },
            urgency: { stringValue: extractedData.urgency || "medium" },
            completed: { booleanValue: false },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        };

        await fetch(dbUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(firestoreDoc)
        });

        const typeLabel = isTodo ? "To-Do" : "求人情報";
        await replyLine(event.replyToken, `✅ ダッシュボードに${typeLabel}を追加しました！\n\n「${extractedData.title}」\n(期限: ${extractedData.deadline})`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack, env: !!process.env.GEMINI_API_KEY });
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
