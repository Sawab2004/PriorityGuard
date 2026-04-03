'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User } from 'lucide-react'
import { Task } from '@/types'
import { cn } from '@/lib/utils'

interface ChatCoachProps {
  tasks: Task[]
}

type Message = { role: 'user' | 'model'; content: string }

export default function ChatCoach({ tasks }: ChatCoachProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "I see your tasks. What's holding you back from starting?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pg_chat_history')
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse chat history", e)
      }
    }
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 1) { // Don't save if it's just the default message
      localStorage.setItem('pg_chat_history', JSON.stringify(messages))
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  const pendingTasks = tasks.filter(t => t.status === 'pending')

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    
    const newMessages = [...messages, { role: 'user' as const, content: input.trim() }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          tasksContext: pendingTasks
        })
      })
      const data = await res.json()
      
      setMessages(prev => [...prev, { role: 'model', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: "Error connecting to server. Just start your top task." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-sage text-white shadow-lg shadow-sage/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[350px] h-[500px] max-h-[80vh] flex flex-col bg-ink/95 backdrop-blur-xl border border-cream/10 rounded-2xl shadow-2xl transition-all duration-300 transform origin-bottom-right",
          isOpen ? "scale-100 opacity-100" : "scale-50 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream/10 bg-ink rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center text-sage">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-cream">PriorityGuard Coach</h3>
              <p className="text-[10px] text-sage">Online • Watching your tasks</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-cream/40 hover:text-cream transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-body shadow-sm",
                  msg.role === 'user'
                    ? "bg-sage text-white rounded-tr-sm"
                    : "bg-white/10 text-cream rounded-tl-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 text-cream/60 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-cream/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-cream/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-cream/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-cream/10 bg-ink/50 rounded-b-2xl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask for advice..."
              className="w-full bg-white/5 border border-cream/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-cream placeholder-cream/30 focus:outline-none focus:ring-1 focus:ring-sage"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="absolute right-2 text-sage hover:text-sage/80 disabled:opacity-50 disabled:hover:text-sage transition-colors p-1"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
