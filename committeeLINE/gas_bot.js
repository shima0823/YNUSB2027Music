const LINE_ACCESS_TOKEN = "YOUR_LINE_ACCESS_TOKEN";
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const FIRESTORE_PROJECT_ID = "ynusb2027music";

function doPost(e) {
  if (!e || !e.postData) return ContentService.createTextOutput("OK");
  
  const json = JSON.parse(e.postData.contents);
  const events = json.events;
  
  if (!events || events.length === 0) {
    return ContentService.createTextOutput("OK");
  }
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type !== "message" || event.message.type !== "text") continue;
    
    const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
    const text = event.message.text.trim();
    
    // GASの簡易ストレージ（キャッシュ）を利用
    const props = PropertiesService.getScriptProperties();
    
    if (text === "!todo") {
      // 直前のメッセージを取得
      const lastMessage = props.getProperty("last_msg_" + sourceId);
      
      if (!lastMessage) {
        replyLine(event.replyToken, "直前のメッセージが見つかりませんでした。");
        continue;
      }
      
      // Geminiで解析
      const todoData = extractTodoWithGemini(lastMessage);
      
      if (!todoData) {
        replyLine(event.replyToken, "タスクの抽出に失敗しました。");
        continue;
      }
      
      // Firestoreに保存
      saveToFirestore(todoData);
      
      // 完了メッセージをLINEに返信
      replyLine(event.replyToken, `✅ ダッシュボードにTo-Doを追加しました！\n\n「${todoData.title}」\n(締切: ${todoData.deadline})`);
      
    } else {
      // !todo以外の普通のメッセージなら、上書き保存
      props.setProperty("last_msg_" + sourceId, text);
    }
  }
  
  return ContentService.createTextOutput("OK");
}

// --- 以下、裏側の処理 ---

function replyLine(replyToken, text) {
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: text }]
    })
  });
}

function extractTodoWithGemini(text) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
  
  const prompt = `
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

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0].content.parts[0].text) {
      return JSON.parse(json.candidates[0].content.parts[0].text);
    }
  }
  return null;
}

function saveToFirestore(todoData) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/todos`;
  
  // REST APIの形式に合わせてデータを変換
  const firestoreDoc = {
    fields: {
      title: { stringValue: todoData.title || "" },
      deadline: { stringValue: todoData.deadline || "" },
      actionUrl: { stringValue: todoData.actionUrl || "" },
      actionLabel: { stringValue: todoData.actionLabel || "" },
      description: { stringValue: todoData.description || "" },
      urgency: { stringValue: todoData.urgency || "medium" },
      completed: { booleanValue: false },
      createdAt: { timestampValue: new Date().toISOString() }
    }
  };
  
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(firestoreDoc)
  });
}
