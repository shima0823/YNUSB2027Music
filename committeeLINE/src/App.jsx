import { useState } from 'react'
import { FileText, Calendar, CheckSquare, Music, Bell, ExternalLink, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('home');

  // モックデータ：To-Doリスト (未提出パートの特定はやめ、シンプルにタスクとアクションリンクを配置)
  const todoList = [
    {
      id: 1,
      title: 'いくわ訪問 乗り人数の提出',
      deadline: '今日 23:59',
      urgency: 'high',
      description: '各パートの乗り人数を確定させてください。',
      actionLabel: '入力フォームへ',
      actionUrl: '#'
    },
    {
      id: 2,
      title: '11月練習の出欠入力',
      deadline: '明日 12:00',
      urgency: 'medium',
      description: '定演練に向けて早めの入力をお願いします。',
      actionLabel: '出欠スプシを開く',
      actionUrl: '#'
    },
    {
      id: 3,
      title: 'スプコン振り返り',
      deadline: '10/15(金) 23:59',
      urgency: 'low',
      description: '各曲の気になったポイントをリフレクションに入力。',
      actionLabel: 'リフレクション入力へ',
      actionUrl: '#'
    }
  ];

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 shadow-md flex flex-col relative overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg tracking-tight">YNUSB 2027 音委ポータル</h1>
          <p className="text-xs text-slate-300">ダッシュボード</p>
        </div>
        <div className="relative">
          <Bell className="w-6 h-6 text-slate-200" />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-slate-800 rounded-full"></span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto space-y-6">
        
        {/* Feature 1: To-Doリスト & アクションリンク */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <h2 className="text-gray-700 font-bold text-sm">現在のTo-Do (やるべきこと)</h2>
          </div>
          
          <div className="space-y-3">
            {todoList.map(task => (
              <div key={task.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${task.urgency === 'high' ? 'border-red-500' : task.urgency === 'medium' ? 'border-amber-400' : 'border-emerald-400'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-800 text-sm">{task.title}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${task.urgency === 'high' ? 'bg-red-50 text-red-600' : task.urgency === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {task.deadline}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{task.description}</p>
                
                {/* 実行するためのリンクをタスク内に直接配置 */}
                <a href={task.actionUrl} className={`flex items-center justify-center w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
                  task.urgency === 'high' ? 'bg-red-50 hover:bg-red-100 text-red-700' : 
                  task.urgency === 'medium' ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 
                  'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                }`}>
                  {task.actionLabel}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Feature 4: リンク集の一元化 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-5 h-5 text-indigo-500" />
            <h2 className="text-gray-700 font-bold text-sm">基本リンク集 (ノートは廃止！)</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
            <a href="#" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mr-4">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">出欠管理スプレッドシート</p>
                <p className="text-xs text-slate-500">基本の出欠入力はこちら</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>

            <a href="#" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mr-4">
                <Music className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">音委リフレクション</p>
                <p className="text-xs text-slate-500">練習の振り返りアプリ</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>

            <a href="#" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-amber-100 p-2 rounded-lg text-amber-600 mr-4">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">議事録・マインドセット保管庫</p>
                <p className="text-xs text-slate-500">Google Driveの共有フォルダへ</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>
          </div>
        </section>

      </main>
    </div>
  )
}

export default App
