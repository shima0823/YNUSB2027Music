import { useState, useEffect } from 'react'
import { FileText, Calendar, CheckSquare, Music, Bell, ExternalLink, CheckCircle2, ChevronRight, ArrowRight, Lock, Unlock, Trash2 } from 'lucide-react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [todoList, setTodoList] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  useEffect(() => {
    // 完了していないTo-Doを取得（古いものから順に）
    const q = query(
      collection(db, 'todos'),
      where('completed', '==', false),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosData = [];
      snapshot.forEach((doc) => {
        todosData.push({ id: doc.id, ...doc.data() });
      });
      setTodoList(todosData);
    });

    return () => unsubscribe();
  }, []);

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      setShowPinInput(!showPinInput);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '2027') {
      setIsAdmin(true);
      setShowPinInput(false);
      setPin('');
    } else {
      alert('パスワードが違います');
    }
  };

  const handleComplete = async (taskId) => {
    if (window.confirm('このタスクを完了（非表示）にしますか？')) {
      const taskRef = doc(db, 'todos', taskId);
      await updateDoc(taskRef, {
        completed: true
      });
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 shadow-md flex flex-col relative overflow-hidden font-sans pb-16">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg tracking-tight">YNUSB 2027 音委ポータル</h1>
          <p className="text-xs text-slate-300">ダッシュボード</p>
        </div>
        <div className="relative">
          <button onClick={handleAdminToggle} className="p-1 rounded-full hover:bg-slate-700 transition">
            {isAdmin ? <Unlock className="w-5 h-5 text-emerald-400" /> : <Lock className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Admin Pin Input */}
      {showPinInput && (
        <div className="bg-slate-800 text-white p-4 animate-in slide-in-from-top-2">
          <form onSubmit={handlePinSubmit} className="flex gap-2">
            <input 
              type="password" 
              placeholder="幹部パスワード" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="flex-1 px-3 py-2 rounded text-slate-900 text-sm"
              autoFocus
            />
            <button type="submit" className="bg-emerald-600 px-4 py-2 rounded text-sm font-bold">ロック解除</button>
          </form>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6">
        
        {/* Feature 1: To-Doリスト */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              <h2 className="text-gray-700 font-bold text-sm">現在のTo-Do (やるべきこと)</h2>
            </div>
            {isAdmin && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">管理者モード</span>}
          </div>
          
          <div className="space-y-3">
            {todoList.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
                現在やるべきタスクはありません 🎉
              </div>
            ) : (
              todoList.map(task => (
                <div key={task.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${task.urgency === 'high' ? 'border-red-500' : task.urgency === 'medium' ? 'border-amber-400' : 'border-emerald-400'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-800 text-sm flex-1 mr-2">{task.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${task.urgency === 'high' ? 'bg-red-50 text-red-600' : task.urgency === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {task.deadline}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleComplete(task.id)} className="p-1 text-slate-400 hover:text-emerald-600 transition">
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {task.description && <p className="text-xs text-slate-500 mb-3">{task.description}</p>}
                  
                  {task.actionUrl && (
                    <a href={task.actionUrl} target="_blank" rel="noreferrer" className={`flex items-center justify-center w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
                      task.urgency === 'high' ? 'bg-red-50 hover:bg-red-100 text-red-700' : 
                      task.urgency === 'medium' ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 
                      'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                    }`}>
                      {task.actionLabel || 'リンクを開く'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  )}
                </div>
              ))
            )}
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
          </div>
        </section>

      </main>
    </div>
  )
}

export default App
