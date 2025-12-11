"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Check, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface PollOption {
  id: string
  option_text: string
  vote_count: number
}

interface Poll {
  id: string
  question: string
  allows_multiple: boolean
  ends_at: string | null
  options: PollOption[]
  totalVotes: number
}

interface PollDisplayProps {
  messageId: string
  currentUserId: string
}

export function PollDisplay({ messageId, currentUserId }: PollDisplayProps) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [votedOptions, setVotedOptions] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isVoting, setIsVoting] = useState(false)

  useEffect(() => {
    loadPoll()
  }, [messageId])

  const loadPoll = async () => {
    try {
      const response = await fetch(`/api/polls?messageId=${messageId}`)
      if (response.ok) {
        const data = await response.json()
        setPoll(data)
      }
    } catch (error) {
      console.error("Error loading poll:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVote = async (optionId: string) => {
    if (!poll || isVoting) return

    // Check if poll has ended
    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      return
    }

    setIsVoting(true)
    try {
      const response = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, optionId }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update voted options
        const newVoted = new Set(votedOptions)
        if (data.action === "added") {
          if (!poll.allows_multiple) {
            newVoted.clear()
          }
          newVoted.add(optionId)
        } else {
          newVoted.delete(optionId)
        }
        setVotedOptions(newVoted)

        // Update poll results
        setPoll(prev => prev ? {
          ...prev,
          options: data.results,
          totalVotes: data.totalVotes
        } : null)
      }
    } catch (error) {
      console.error("Error voting:", error)
    } finally {
      setIsVoting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-4" />
        <div className="space-y-2">
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!poll) return null

  const isEnded = poll.ends_at && new Date(poll.ends_at) < new Date()
  const maxVotes = Math.max(...poll.options.map(o => o.vote_count), 1)

  return (
    <div className="p-4 border rounded-lg bg-muted/30 max-w-sm">
      <div className="flex items-start gap-2 mb-3">
        <BarChart3 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium">{poll.question}</h4>
          {poll.allows_multiple && (
            <p className="text-xs text-muted-foreground">Puedes elegir varias opciones</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const percentage = poll.totalVotes > 0 
            ? Math.round((option.vote_count / poll.totalVotes) * 100) 
            : 0
          const isVoted = votedOptions.has(option.id)
          const isWinning = option.vote_count === maxVotes && option.vote_count > 0

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={isVoting || !!isEnded}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden",
                isVoted 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50",
                isEnded && "cursor-default"
              )}
            >
              {/* Progress background */}
              <div 
                className={cn(
                  "absolute inset-0 transition-all",
                  isWinning ? "bg-primary/20" : "bg-muted"
                )}
                style={{ width: `${percentage}%` }}
              />
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isVoted && <Check className="h-4 w-4 text-primary" />}
                  <span className={cn(isVoted && "font-medium")}>
                    {option.option_text}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {percentage}%
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{poll.totalVotes} voto{poll.totalVotes !== 1 ? "s" : ""}</span>
        </div>
        {isEnded && <span className="text-red-500">Encuesta finalizada</span>}
      </div>
    </div>
  )
}
