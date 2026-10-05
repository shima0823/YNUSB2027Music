import { useState } from 'react'
import { FileText, Calendar, CheckSquare, Music, Bell } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 shadow-md flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <h1 className="font-bold text-lg">YNUSB 2027 音委ポータル</h1>
        <Bell className="w-5 h-5 text-indigo-100" />
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {/* Alerts / Announcements */}
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-3 mb-6 rounded text-sm">
          <p className="font-bold">最新のアナウンス</p>
          <p>10/10までに所信表明の提出をお願いします！</p>
        </div>

        <h2 className="text-gray-500 font-semibold text-sm mb-3">クイックアクセス</h2>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <a href="#" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">総会資料</span>
          </a>
          
          <a href="#" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <CheckSquare className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">提出フォーム</span>
          </a>

          <a href="#" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
              <Music className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">リフレクション</span>
          </a>

          <a href="#" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition">
            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">日程調整</span>
          </a>
        </div>

        <h2 className="text-gray-500 font-semibold text-sm mb-3">直近のタスク一覧</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          <div className="p-3 flex items-start gap-3">
            <input type="checkbox" className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-800">総会1次資料の確認</p>
              <p className="text-xs text-gray-500">締切: 10月6日</p>
            </div>
          </div>
          <div className="p-3 flex items-start gap-3">
            <input type="checkbox" className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-800">総会用 所信表明の提出</p>
              <p className="text-xs text-gray-500">締切: 10月10日</p>
            </div>
          </div>
          <div className="p-3 flex items-start gap-3 opacity-50">
            <input type="checkbox" checked readOnly className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <div className="line-through">
              <p className="text-sm font-medium text-gray-800">プレ総会 日程調整</p>
              <p className="text-xs text-gray-500">締切: 10月5日</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
