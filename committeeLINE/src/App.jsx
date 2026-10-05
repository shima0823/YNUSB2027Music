import { useState } from 'react'
import { FileText, Calendar, CheckSquare, Music, Bell, ExternalLink, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('home');

  // モックデータ：未提出の状況
  const pendingTasks = [
    {
      id: 1,
      title: 'いくわ訪問 乗り人数の提出',
      deadline: '今日 23:59',
      urgency: 'high',
      missingParts: ['Sax', 'Hr', 'Tb'],
      completedParts: ['Fl', 'Cl', 'B.Cl', 'Tp', 'Euph', 'Tuba', 'Perc']
    },
    {
      id: 2,
      title: '11月練習の出欠入力 (スプシ)',
      deadline: '明日 12:00',
      urgency: 'medium',
      missingParts: ['Fl', 'B.Cl', 'Euph', 'Perc'],
      completedParts: ['Cl', 'Sax', 'Tp', 'Hr', 'Tb', 'Tuba']
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
        
        {/* Feature 1: 「未提出は誰？」ウィジェット */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="text-gray-700 font-bold text-sm">現在のタスク ＆ 未提出状況</h2>
          </div>
          
          <div className="space-y-3">
            {pendingTasks.map(task => (
              <div key={task.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${task.urgency === 'high' ? 'border-red-500' : 'border-amber-400'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-800 text-sm">{task.title}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${task.urgency === 'high' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    {task.deadline}
                  </span>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-3 mt-3">
                  <p className="text-xs text-slate-500 font-bold mb-1">未提出パート（急ぎ！）</p>
                  <div className="flex flex-wrap gap-1">
                    {task.missingParts.map(part => (
                      <span key={part} className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
                        {part}
                      </span>
                    ))}
                    {task.missingParts.length === 0 && (
                      <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>全員提出済</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature 4: リンク集の一元化 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-5 h-5 text-indigo-500" />
            <h2 className="text-gray-700 font-bold text-sm">重要リンク集 (ノートは廃止！)</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
            
            {/* Category 1 */}
            <a href="#" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mr-4">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">出欠管理スプレッドシート</p>
                <p className="text-xs text-slate-500">11月・定演練の出欠はこちら</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>

            {/* Category 2 */}
            <a href="#" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mr-4">
                <Music className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">音委リフレクション入力</p>
                <p className="text-xs text-slate-500">各曲の気になったポイントを送信</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>

            {/* Category 3 */}
            <a href="#" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-green-100 p-2 rounded-lg text-green-600 mr-4">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">各種投票・アンケート集</p>
                <p className="text-xs text-slate-500">選曲投票や好感度フォームなど</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>

            {/* Category 4 */}
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
