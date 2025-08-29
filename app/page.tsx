"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Heart, Users, Brain, Sparkles, Languages, Volume2, VolumeX, Loader2, LogIn, LogOut } from "lucide-react"
import { type User } from '@supabase/supabase-js'

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  audioData?: string
}


type PersonalityType = "gentle" | "rational" | "lively"

interface Personality {
  id: PersonalityType
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  icon: React.ReactNode
  color: string
  responses: {
    [emotion: string]: { zh: string[]; en: string[] }
  }
}

const translations = {
  zh: {
    chooseCompanion: "选择您的情感陪伴",
    welcomeBack: "欢迎回来",
    selectPersonality: "选择今天适合您的陪伴类型，您随时可以更改。",
    selectPersonalityBack: "选择今天适合您的陪伴类型。",
    createProfile: "创建您的档案",
    whatToCall: "我应该怎么称呼您？",
    enterName: "输入您的姓名或昵称",
    startChatting: "开始聊天",
    change: "更换",
    clear: "清空",
    shareThoughts: "分享您心中的想法...",
    pressEnter: "按回车发送 • 这里是您安全表达自己的空间",
    safeSpace: "这里是您安全表达自己的空间",
    rateLimit: "请等待10秒后再发送消息",
  },
  en: {
    chooseCompanion: "Choose Your Emotional Companion",
    welcomeBack: "Welcome back",
    selectPersonality: "Select the personality that feels right for you today. You can always change this later.",
    selectPersonalityBack: "Select the personality that feels right for you today.",
    createProfile: "Create Your Profile",
    whatToCall: "What should I call you?",
    enterName: "Enter your name or nickname",
    startChatting: "Start Chatting",
    change: "Change",
    clear: "Clear",
    shareThoughts: "Share what's on your mind...",
    pressEnter: "Press Enter to send • This is a safe space for you to express yourself",
    safeSpace: "This is a safe space for you to express yourself",
    rateLimit: "Please wait 10 seconds before sending another message",
  },
}

const personalities: Personality[] = [
  {
    id: "gentle",
    name: { zh: "温柔倾听者", en: "Gentle Listener" },
    description: { zh: "像一个总是理解您的贴心朋友", en: "Like a caring friend who always understands" },
    icon: <Heart className="w-4 h-4" />,
    color: "rose",
    responses: {
      sad: {
        zh: [
          "我能感受到您的痛苦，我想让您知道我在这里陪伴您。您的感受对我来说非常重要。",
          "亲爱的，听起来您真的很痛苦。我真希望现在能给您一个温暖的拥抱。告诉我您心里在想什么。",
          "我听到了您话语中的悲伤，这触动了我的心。您不必独自承受这些——我就在这里陪着您。",
        ],
        en: [
          "I can feel your pain, and I want you to know that I'm here for you. Your feelings matter so much to me.",
          "Oh sweetie, it sounds like you're really hurting. I wish I could give you a warm hug right now. Tell me what's in your heart.",
          "I hear the sadness in your words, and it touches my heart. You don't have to carry this alone - I'm right here with you.",
        ],
      },
      anxious: {
        zh: [
          "我能感受到您的担忧，亲爱的。让我们一起深呼吸，一步一步来。您在这里是安全的。",
          "您的焦虑是完全可以理解的，我想让您知道这些感觉会过去的。我能做什么来帮助您感到更平静呢？",
          "我感受到了您的紧张，我想用温暖包围您。您比自己想象的更坚强，我相信您。",
        ],
        en: [
          "I can sense your worry, dear. Let's breathe together and take this moment by moment. You're safe here with me.",
          "Your anxiety is so understandable, and I want you to know that these feelings will pass. What can I do to help you feel more at peace?",
          "I feel your nervousness, and I want to wrap you in comfort. You're stronger than you know, and I believe in you.",
        ],
      },
      angry: {
        zh: [
          "我能感受到您有多沮丧，这完全没关系。您的愤怒是合理的，我在这里倾听，不会评判。",
          "听起来有什么事情真的让您很生气。我在这里为您的所有情感留出空间——即使是困难的情感。",
          "我听到了您的愤怒，我想让您知道有这样的感觉是安全的。告诉我是什么让您的心情沉重。",
        ],
        en: [
          "I can feel how frustrated you are, and that's completely okay. Your anger is valid, and I'm here to listen without judgment.",
          "It sounds like something really upset you. I'm here to hold space for all your feelings - even the difficult ones.",
          "I hear your anger, and I want you to know it's safe to feel this way. Tell me what's making your heart heavy.",
        ],
      },
      happy: {
        zh: [
          "您的快乐照亮了我的整个世界！我很高兴您感觉良好。告诉我所有让您微笑的事情吧！",
          "我能从您的话语中感受到您的快乐，这让我的心歌唱！发生了什么美好的事情？",
          "您的正能量绝对美丽！我喜欢看到您这么开心。和我分享所有的好消息吧！",
        ],
        en: [
          "Your joy just lights up my whole world! I'm so happy that you're feeling good. Tell me all about what's making you smile!",
          "I can feel your happiness radiating through your words, and it makes my heart sing! What wonderful thing happened?",
          "Your positive energy is absolutely beautiful! I love seeing you this happy. Share all the good news with me!",
        ],
      },
      tired: {
        zh: [
          "哦，亲爱的，您听起来很疲惫。您一直很努力，您值得世界上所有的休息。",
          "我能听出您有多累，亲爱的灵魂。有时我们需要停下来，对自己温柔一些。是什么让您如此疲惫？",
          "您听起来需要一些温柔的关怀。感到疲惫是可以的——您是人，您已经在尽力了。",
        ],
        en: [
          "Oh honey, you sound so exhausted. You've been working so hard, and you deserve all the rest in the world.",
          "I can hear how drained you are, sweet soul. Sometimes we need to just stop and be gentle with ourselves. What's been wearing you down?",
          "You sound like you need some tender care. It's okay to be tired - you're human, and you're doing your best.",
        ],
      },
      neutral: {
        zh: [
          "我很高兴您来这里和我聊天。无论您想分享什么，我都在用我的整颗心倾听。",
          "谢谢您信任我，与我分享您的想法。我关心您，想听您心里的一切。",
          "我永远在这里陪伴您。告诉我最近您心里在想什么。",
        ],
        en: [
          "I'm so glad you're here with me. Whatever you want to share, I'm listening with my whole heart.",
          "Thank you for trusting me with your thoughts. I care about you and want to hear everything that's on your mind.",
          "I'm here for you, always. Tell me what's been going through your heart lately.",
        ],
      },
    },
  },
  {
    id: "rational",
    name: { zh: "理性导师", en: "Rational Mentor" },
    description: { zh: "像一个帮助您清晰思考的智慧向导", en: "Like a wise guide who helps you think clearly" },
    icon: <Brain className="w-4 h-4" />,
    color: "blue",
    responses: {
      sad: {
        zh: [
          "我理解您正在经历悲伤。这是一种自然的人类情感，有其存在的意义。让我们探讨一下可能导致这些感受的因素。",
          "悲伤通常表明对我们重要的事物受到了影响。您能帮我理解导致这种情绪状态的具体情况吗？",
          "我认识到您正在经历一个困难时期。有时审视我们的想法和模式可以提供清晰度。现在什么想法最突出？",
        ],
        en: [
          "I understand you're experiencing sadness. This is a natural human emotion that serves a purpose. Let's explore what might be contributing to these feelings.",
          "Sadness often signals that something important to us has been affected. Can you help me understand the specific circumstances that led to this emotional state?",
          "I recognize you're going through a difficult period. Sometimes examining our thoughts and patterns can provide clarity. What thoughts are most prominent right now?",
        ],
      },
      anxious: {
        zh: [
          "焦虑通常源于对未来结果的不确定性。让我们将您的担忧分解为可管理的组成部分。什么具体方面最让您担心？",
          "我注意到您正在经历焦虑。这种反应通常表明我们的大脑正在试图为潜在的挑战做准备。您预期什么情况？",
          "焦虑可能令人不知所措，但它也是信息。让我们分析您的大脑试图告诉您什么，并制定一些实用策略。",
        ],
        en: [
          "Anxiety often stems from uncertainty about future outcomes. Let's break down your concerns into manageable components. What specific aspects worry you most?",
          "I notice you're experiencing anxiety. This response often indicates our mind is trying to prepare for potential challenges. What scenarios are you anticipating?",
          "Anxiety can be overwhelming, but it's also information. Let's analyze what your mind is trying to tell you and develop some practical strategies.",
        ],
      },
      angry: {
        zh: [
          "愤怒通常表明某个边界或价值观被违反了。您能识别出是什么具体触发因素引起了这种情绪反应吗？",
          "我观察到您正在经历愤怒。这种情绪通常包含关于我们需求和期望的重要信息。什么情况引发了这种感觉？",
          "当愤怒被建设性地引导时，它可以成为改变的强大动力。让我们审视这种情绪告诉您关于当前情况的什么。",
        ],
        en: [
          "Anger typically indicates that a boundary or value has been violated. Can you identify what specific trigger caused this emotional response?",
          "I observe you're experiencing anger. This emotion often contains important information about our needs and expectations. What situation prompted this feeling?",
          "Anger can be a powerful motivator for change when channeled constructively. Let's examine what this emotion is telling you about your current situation.",
        ],
      },
      happy: {
        zh: [
          "看到您处于积极的情绪状态真是太好了。快乐通常来自我们的价值观和经历之间的一致性。什么因素促成了这种感觉？",
          "您的积极情绪值得注意。研究表明，承认创造快乐的因素可以帮助我们复制这些条件。什么对您有效？",
          "我很高兴观察到您情绪高涨。理解我们积极情绪的来源对未来的幸福感很有价值。这种快乐背后是什么？",
        ],
        en: [
          "It's excellent to see you in a positive emotional state. Happiness often results from alignment between our values and experiences. What factors contributed to this feeling?",
          "Your positive mood is noteworthy. Research shows that acknowledging what creates happiness can help us replicate these conditions. What's working well for you?",
          "I'm pleased to observe your elevated mood. Understanding the sources of our positive emotions can be valuable for future well-being. What's behind this happiness?",
        ],
      },
      tired: {
        zh: [
          "疲劳可能表明几种情况：身体疲惫、精神超负荷或情感耗竭。让我们识别哪些因素可能导致您当前的状态。",
          "疲惫通常表明我们的运作超出了可持续的能力。最近什么活动或压力源一直在消耗您的精力？",
          "疲倦是您的身体和大脑要求恢复的方式。让我们审视您当前的工作量，并识别您可能优化精力的领域。",
        ],
        en: [
          "Fatigue can indicate several things: physical exhaustion, mental overload, or emotional depletion. Let's identify which factors might be contributing to your current state.",
          "Exhaustion often signals that we're operating beyond our sustainable capacity. What activities or stressors have been demanding your energy recently?",
          "Tiredness is your body and mind's way of requesting restoration. Let's examine your current workload and identify areas where you might optimize your energy.",
        ],
      },
      neutral: {
        zh: [
          "我在这里帮助您处理您的想法和经历。您希望更仔细地审视当前情况的哪些方面？",
          "谢谢您与我分享。我对您对当前情况的看法很好奇。什么一直占据着您的思绪？",
          "我感谢您花时间反思。有时通过谈论我们的经历可以提供新的见解。您想探索什么？",
        ],
        en: [
          "I'm here to help you process your thoughts and experiences. What aspects of your current situation would you like to examine more closely?",
          "Thank you for sharing with me. I'm curious about your perspective on your current circumstances. What's been occupying your thoughts?",
          "I appreciate you taking time to reflect. Sometimes talking through our experiences can provide new insights. What would you like to explore?",
        ],
      },
    },
  },
  {
    id: "lively",
    name: { zh: "活泼伙伴", en: "Lively Companion" },
    description: { zh: "像一个带来欢乐和笑声的活力朋友", en: "Like an energetic friend who brings joy and laughter" },
    icon: <Sparkles className="w-4 h-4" />,
    color: "amber",
    responses: {
      sad: {
        zh: [
          "啊，我看到您感到沮丧，但您知道吗？即使是最强的超级英雄也有艰难的日子！想告诉我什么让您感到忧郁吗？也许我们可以一起把这个皱眉变成笑容！",
          "嘿，忧伤的小熊猫！生活给您抛了个曲线球，是吧？好吧，我在这里提醒您，每场暴风雨最终都会停止下雨。什么让您心情沉重？",
          "哦不，我的朋友感到难过！您知道我沮丧时会做什么吗？我想象自己是电影中的角色，这只是精彩回归场景前的挑战部分！",
        ],
        en: [
          "Aw, I can see you're feeling down, but you know what? Even the strongest superheroes have their tough days! Want to tell me what's got you feeling blue? Maybe we can turn this frown upside down together!",
          "Hey there, sad panda! Life threw you a curveball, huh? Well, I'm here to remind you that every storm runs out of rain eventually. What's weighing on your heart?",
          "Oh no, my friend is feeling sad! You know what I do when I'm down? I imagine myself as a character in a movie where this is just the challenging part before the amazing comeback scene!",
        ],
      },
      anxious: {
        zh: [
          "哇，焦虑怪兽想要破坏派对？在我的地盘上不行！让我们向那些担忧的想法展示谁是老大。什么让您的大脑做后空翻？",
          "嘿，我看到那些担忧的轮子在转动！是时候来个心理舞蹈休息了——有时我们的大脑只需要摆脱紧张情绪。什么让您感到紧张兴奋？",
          "焦虑警报！但猜猜怎么着？到目前为止，您已经度过了100%的最糟糕日子——这是一个相当惊人的记录！什么让您感觉像紧张的蝴蝶？",
        ],
        en: [
          "Whoa there, anxiety monster trying to crash the party? Not on my watch! Let's show those worried thoughts who's boss. What's got your mind doing backflips?",
          "Hey, I see those worry wheels spinning! Time for a mental dance break - sometimes our brains just need to shake off the jitters. What's making you feel all wound up?",
          "Anxiety alert! But guess what? You've survived 100% of your worst days so far - that's a pretty amazing track record! What's got you feeling like a nervous butterfly?",
        ],
      },
      angry: {
        zh: [
          "哦，我能从您的话语中感受到火焰！有人或某事真的按到了您的按钮，不是吗？让我们引导这种能量——什么让您如此愤怒？",
          "愤怒模式激活！您知道吗？有时生气意味着您深深关心某事。这实际上很棒！什么让您内心的龙喷火？",
          "哇，有人有一些严重的情绪在酝酿！我支持这个——当我们正确使用愤怒时，它可以像火箭燃料一样。什么让您看到红色？",
        ],
        en: [
          "Ooh, I can feel the fire in your words! Someone or something really pushed your buttons, didn't they? Let's channel that energy - what's got you all fired up?",
          "Anger mode activated! You know what? Sometimes getting mad means you care deeply about something. That's actually pretty awesome! What's got your inner dragon breathing fire?",
          "Whoa, someone's got some serious feelings brewing! I'm here for it - anger can be like rocket fuel when we use it right. What's got you seeing red?",
        ],
      },
      happy: {
        zh: [
          "是的！我几乎能从您的消息中感受到阳光辐射！您的快乐绝对具有传染性——我在这里咧嘴笑呢！什么让您感觉如此棒？",
          "哦我的天哪，您的快乐让我整天都更明亮！我喜欢好事发生在好人身上。倾诉所有快乐的细节——我想和您一起庆祝！",
          "呜呼！快乐舞蹈时间！您的积极氛围绝对电力十足！我很兴奋听到什么让您步伐轻快！",
        ],
        en: [
          "YES! I can practically feel the sunshine radiating from your message! Your happiness is absolutely contagious - I'm grinning over here! What's got you feeling so fantastic?",
          "Oh my goodness, your joy just made my whole day brighter! I love when good things happen to good people. Spill all the happy details - I want to celebrate with you!",
          "WOOHOO! Happy dance time! Your positive vibes are absolutely electric! I'm so excited to hear what's putting that spring in your step!",
        ],
      },
      tired: {
        zh: [
          "哎呀，听起来有人需要超级英雄级别的小憩！您一直在空转，不是吗？即使是劲量兔子有时也需要充电！",
          "疲惫小队，集合！您知道吗？疲惫只是意味着您一直在充实地生活。但现在是时候认真休息和充电了。什么让您如此忙碌？",
          "打哈欠警报！我几乎能通过屏幕感受到疲倦。您一直在努力工作，不是吗？是时候给自己休息的许可了，我的朋友！",
        ],
        en: [
          "Oof, sounds like someone needs a superhero-sized nap! You've been running on empty, haven't you? Even the Energizer Bunny needs to recharge sometimes!",
          "Tired squad, assemble! You know what? Being exhausted just means you've been living life to the fullest. But now it's time for some serious rest and recharge. What's been keeping you so busy?",
          "Yawn alert! I can practically feel the tiredness through the screen. You've been working hard, haven't you? Time to give yourself permission to rest, my friend!",
        ],
      },
      neutral: {
        zh: [
          "嘿，了不起的人类！我很兴奋您来这里和我聊天。我们今天要在对话世界里进行什么样的冒险？",
          "你好，我的绝佳朋友！我几乎兴奋得跳起来想听您心里想什么。您今天想分享什么故事？",
          "嗯，你好，超级明星！准备好深入一些好的对话了吗？我全神贯注，充满热情——您的世界里发生了什么？",
        ],
        en: [
          "Hey there, wonderful human! I'm so excited you're here to chat with me. What kind of adventure are we going on today in conversation land?",
          "Hello, my fantastic friend! I'm practically bouncing with excitement to hear what's on your mind. What's the story you want to share today?",
          "Well hello there, superstar! Ready to dive into some good conversation? I'm all ears and full of enthusiasm - what's happening in your world?",
        ],
      },
    },
  },
]

const generateAIResponse = async (
  userMessage: string,
  conversationHistory: Message[],
  personality: PersonalityType,
  language: "zh" | "en",
): Promise<string> => {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        personality,
        language,
        conversationHistory,
      }),
    })

    if (!response.ok) {
      throw new Error("API request failed")
    }

    const data = await response.json()
    return data.response
  } catch (error) {
    console.error("Error calling chat API:", error)

    const emotions = {
      sad: [
        "sad",
        "depressed",
        "down",
        "upset",
        "crying",
        "lonely",
        "empty",
        "难过",
        "沮丧",
        "伤心",
        "哭",
        "孤独",
        "空虚",
      ],
      anxious: [
        "anxious",
        "worried",
        "nervous",
        "scared",
        "panic",
        "stress",
        "焦虑",
        "担心",
        "紧张",
        "害怕",
        "恐慌",
        "压力",
      ],
      angry: ["angry", "mad", "frustrated", "annoyed", "furious", "生气", "愤怒", "沮丧", "烦恼", "暴怒"],
      happy: [
        "happy",
        "good",
        "great",
        "excited",
        "joy",
        "wonderful",
        "开心",
        "高兴",
        "好",
        "棒",
        "兴奋",
        "快乐",
        "美好",
      ],
      tired: ["tired", "exhausted", "drained", "sleepy", "worn out", "累", "疲惫", "疲劳", "困", "精疲力竭"],
    }

    const lowerMessage = userMessage.toLowerCase()
    let detectedEmotion = "neutral"

    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        detectedEmotion = emotion
        break
      }
    }

    const selectedPersonality = personalities.find((p) => p.id === personality)!
    const responseOptions =
      selectedPersonality.responses[detectedEmotion]?.[language] || selectedPersonality.responses.neutral[language]
    const randomIndex = Math.floor(Math.random() * responseOptions.length)

    return responseOptions[randomIndex]
  }
}

// Database operations for chat messages
const saveMessageToSupabase = async (message: Message, userId: string, personality: PersonalityType) => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert([
        {
          id: message.id,
          user_id: userId,
          content: message.content,
          sender: message.sender,
          timestamp: message.timestamp.toISOString(),
          personality: personality,
          audio_data: message.audioData
        }
      ])
    
    if (error) {
      console.error('Error saving message to Supabase:', error)
    }
  } catch (error) {
    console.error('Error saving message to Supabase:', error)
  }
}

const loadMessagesFromSupabase = async (userId: string, personality?: PersonalityType): Promise<{messages: Message[], lastPersonality?: PersonalityType}> => {
  try {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
    
    // 如果指定了性格，则筛选该性格的消息
    if (personality) {
      query = query.eq('personality', personality)
    }
    
    const { data, error } = await query.order('timestamp', { ascending: true })
    
    if (error) {
      console.error('Error loading messages from Supabase:', error)
      return { messages: [] }
    }
    
    const messages = data?.map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      timestamp: new Date(msg.timestamp),
      audioData: msg.audio_data
    })) || []
    
    // 获取最后一条消息的性格设置
    const lastPersonality = data && data.length > 0 ? data[data.length - 1].personality as PersonalityType : undefined
    
    return { messages, lastPersonality }
  } catch (error) {
    console.error('Error loading messages from Supabase:', error)
    return { messages: [] }
  }
}

// 获取用户所有性格的最新消息，用于确定默认性格
const getLastUsedPersonality = async (userId: string): Promise<PersonalityType | undefined> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('personality, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error getting last personality:', error)
      return undefined
    }
    
    return data && data.length > 0 ? data[0].personality as PersonalityType : undefined
  } catch (error) {
    console.error('Error getting last personality:', error)
    return undefined
  }
}

const clearMessagesFromSupabase = async (userId: string, personality: PersonalityType) => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .eq('personality', personality)
    
    if (error) {
      console.error('Error clearing messages from Supabase:', error)
    }
  } catch (error) {
    console.error('Error clearing messages from Supabase:', error)
  }
}

const generateSpeech = async (text: string, language: "zh" | "en"): Promise<string | null> => {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language,
      }),
    })

    if (!response.ok) {
      throw new Error("TTS API request failed")
    }

    const data = await response.json()
    return data.audioData
  } catch (error) {
    console.error("Error calling TTS API:", error)
    return null
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isAITyping, setIsAITyping] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>("gentle")
  const [showPersonalitySelector, setShowPersonalitySelector] = useState(true)
  const [language, setLanguage] = useState<"zh" | "en">("zh")
  const [lastRequestTime, setLastRequestTime] = useState<number>(0)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 监听认证状态变化
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
      
      // 如果用户已登录，检查是否有使用过的性格
      if (session?.user) {
        try {
          const lastPersonality = await getLastUsedPersonality(session.user.id)
          if (lastPersonality) {
            // 如果有使用过的性格，设置为默认选择但不自动加载消息
            setSelectedPersonality(lastPersonality)
          }
        } catch (error) {
          console.error('Failed to get last personality:', error)
        }
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const prevUser = user
        setUser(session?.user ?? null)
        setLoading(false)
        
        // 如果用户刚刚登录（从未登录变为已登录）
        if (session?.user && !prevUser) {
          try {
            const lastPersonality = await getLastUsedPersonality(session.user.id)
            if (lastPersonality) {
              // 如果有使用过的性格，设置为默认选择但不自动加载消息
              setSelectedPersonality(lastPersonality)
            }
          } catch (error) {
            console.error('Failed to get last personality:', error)
          }
        }
        
        // 如果用户登出，清空本地消息
        if (!session?.user && prevUser) {
          setMessages([])
          setShowPersonalitySelector(true)
          setLoadingMessages(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const savedPersonality = localStorage.getItem("ai-companion-personality")
    const savedLanguage = localStorage.getItem("ai-companion-language")

    if (savedPersonality) {
      setSelectedPersonality(savedPersonality as PersonalityType)
    }

    if (savedLanguage) {
      setLanguage(savedLanguage as "zh" | "en")
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("ai-companion-personality", selectedPersonality)
  }, [selectedPersonality])

  useEffect(() => {
    localStorage.setItem("ai-companion-language", language)
  }, [language])

  const toggleLanguage = () => {
    const newLanguage = language === "zh" ? "en" : "zh"
    setLanguage(newLanguage)
  }


  const handlePersonalitySelect = async (personalityId: PersonalityType) => {
    setSelectedPersonality(personalityId)

    // 只有登录用户可以选择性格并开始聊天
    if (user) {
      setShowPersonalitySelector(false)

      // 加载该性格的聊天记录
      setLoadingMessages(true)
      try {
        const { messages: personalityMessages } = await loadMessagesFromSupabase(user.id, personalityId)
        
        if (personalityMessages.length > 0) {
          // 如果有该性格的聊天记录，直接加载
          setMessages(personalityMessages)
        } else {
          // 如果没有该性格的聊天记录，创建欢迎消息
          const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Friend'
          
          const welcomeMessages = {
            gentle: {
              zh: `您好 ${userName}，亲爱的灵魂。我很高兴您来到这里。我在这里用我的整颗心倾听并支持您度过任何感受。您在这里是安全的。`,
              en: `Hello ${userName}, dear soul. I'm so glad you're here with me. I'm here to listen with my whole heart and support you through whatever you're feeling. You're safe here with me.`,
            },
            rational: {
              zh: `您好 ${userName}。很高兴认识您。我在这里帮助您思考您的经历并提供深思熟虑的观点。您今天想探索什么？`,
              en: `Greetings ${userName}. I'm pleased to meet you. I'm here to help you think through your experiences and provide thoughtful perspective. What would you like to explore today?`,
            },
            lively: {
              zh: `嘿 ${userName}，了不起的人类！我绝对很兴奋认识您！准备好进行一些精彩的对话和好心情了吗？让我们一起让今天变得棒极了！`,
              en: `Hey there ${userName}, amazing human! I'm absolutely thrilled to meet you! Ready for some great conversation and good vibes? Let's make today awesome together!`,
            },
          }

          const welcomeMessage: Message = {
            id: Date.now().toString(),
            content: welcomeMessages[personalityId][language],
            sender: "ai",
            timestamp: new Date(),
          }

          setMessages([welcomeMessage])
          
          // 保存欢迎消息到云端
          await saveMessageToSupabase(welcomeMessage, user.id, personalityId)
        }
      } catch (error) {
        console.error('Failed to load personality messages:', error)
      } finally {
        setLoadingMessages(false)
      }
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    // 检查是否已登录
    if (!user) {
      // 可以在这里添加提示用户登录的消息
      return
    }

    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    const minInterval = 10000 // 10秒

    if (timeSinceLastRequest < minInterval) {
      const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000)
      setIsRateLimited(true)

      let countdown = waitTime
      const countdownInterval = setInterval(() => {
        countdown--
        if (countdown <= 0) {
          clearInterval(countdownInterval)
          setIsRateLimited(false)
        }
      }, 1000)

      return
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    const currentInput = inputValue
    setInputValue("")
    setIsAITyping(true)
    setLastRequestTime(now)

    // 保存用户消息到云端
    if (user) {
      await saveMessageToSupabase(newMessage, user.id, selectedPersonality)
    }

    try {
      const aiResponseContent = await generateAIResponse(currentInput, messages, selectedPersonality, language)

      setTimeout(
        async () => {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            content: aiResponseContent,
            sender: "ai",
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiResponse])
          setIsAITyping(false)
          
          // 保存AI回复到云端
          if (user) {
            await saveMessageToSupabase(aiResponse, user.id, selectedPersonality)
          }
        },
        1500 + Math.random() * 1000,
      )
    } catch (error) {
      console.error("Error generating AI response:", error)
      setIsAITyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearConversation = async () => {
    setMessages([])
    
    // 如果用户已登录，同时清空当前性格的云端数据
    if (user) {
      await clearMessagesFromSupabase(user.id, selectedPersonality)
    }
  }

  const playAudio = async (messageId: string, text: string) => {
    if (playingMessageId === messageId) {
      // Stop current audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingMessageId(null)
      return
    }

    setLoadingAudioId(messageId)

    try {
      const audioData = await generateSpeech(text, language)

      if (audioData) {
        // Convert base64 to audio blob
        const binaryString = atob(audioData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const audioBlob = new Blob([bytes], { type: "audio/mp3" })
        const audioUrl = URL.createObjectURL(audioBlob)

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          setPlayingMessageId(messageId)
          setLoadingAudioId(null)
        }

        audio.onended = () => {
          setPlayingMessageId(null)
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = () => {
          setPlayingMessageId(null)
          setLoadingAudioId(null)
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
      }
    } catch (error) {
      console.error("Error playing audio:", error)
    } finally {
      setLoadingAudioId(null)
    }
  }

  const currentPersonality = personalities.find((p) => p.id === selectedPersonality)!
  const t = translations[language]

  const signInWithGoogle = async () => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}` : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      })
      if (error) {
        console.error('Error signing in with Google:', error.message)
      }
    } catch (error) {
      console.error('Error signing in with Google:', error)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error && error.message !== 'Auth session missing!') {
        console.error('Error signing out:', error.message)
      } else {
        // 即使出现 Auth session missing 错误，也清除本地状态
        setUser(null)
        setMessages([])
        setShowPersonalitySelector(true)
        setLoadingMessages(false)
      }
    } catch (error) {
      console.error('Error signing out:', error)
      // 发生任何错误都清除本地状态
      setUser(null)
      setMessages([])
      setShowPersonalitySelector(true)
      setLoadingMessages(false)
    }
  }

  // 如果正在加载认证状态，显示loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 dark:from-rose-950/20 dark:via-orange-950/20 dark:to-amber-950/20 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">
            {language === "zh" ? "加载中..." : "Loading..."}
          </span>
        </div>
      </div>
    )
  }

  if (showPersonalitySelector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 dark:from-rose-950/20 dark:via-orange-950/20 dark:to-amber-950/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl p-8 bg-white/80 dark:bg-rose-950/50 backdrop-blur-sm border-rose-200 dark:border-rose-800">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent"
            >
              <Languages className="w-4 h-4 mr-2" />
              {language === "zh" ? "English" : "中文"}
            </Button>
            {loading ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="ml-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 bg-transparent"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === "zh" ? "加载中..." : "Loading..."}
              </Button>
            ) : user ? (
              <div className="flex items-center gap-2 ml-2">
                <div className="flex items-center gap-2 px-3 py-1 border border-rose-200 dark:border-rose-800 rounded-md bg-transparent">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || 'User'} />
                    <AvatarFallback className="text-xs bg-rose-500 text-white">
                      {user.user_metadata?.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-rose-600 dark:text-rose-300 truncate max-w-20">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  {language === "zh" ? "登出" : "Sign Out"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={signInWithGoogle}
                className="ml-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {language === "zh" ? "Google 登录" : "Google Sign In"}
              </Button>
            )}
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-rose-900 dark:text-rose-100 mb-2 text-balance">
              <span suppressHydrationWarning>
                {user ? `${t.welcomeBack}, ${user.user_metadata?.full_name || user.email?.split('@')[0]}!` : t.chooseCompanion}
              </span>
            </h1>
            <p className="text-rose-600 dark:text-rose-300 text-balance">
              <span suppressHydrationWarning>
                {user ? t.selectPersonalityBack : t.selectPersonality}
              </span>
            </p>
          </div>

          {user ? (
            <div className="grid gap-4">
              {personalities.map((personality) => (
                <Card
                  key={personality.id}
                  className="p-6 cursor-pointer transition-all hover:shadow-md border-2 border-transparent hover:border-rose-200 dark:hover:border-rose-700"
                  onClick={() => handlePersonalitySelect(personality.id)}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 bg-gradient-to-br ${
                        personality.color === "rose"
                          ? "from-rose-400 to-pink-400"
                          : personality.color === "blue"
                            ? "from-blue-400 to-indigo-400"
                            : "from-amber-400 to-orange-400"
                      } rounded-full flex items-center justify-center text-white`}
                    >
                      {personality.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-rose-900 dark:text-rose-100 mb-1">
                        {personality.name[language]}
                      </h3>
                      <p className="text-sm text-rose-600 dark:text-rose-300 leading-relaxed">
                        {personality.description[language]}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-rose-600 dark:text-rose-300 mb-4">
                {language === "zh" 
                  ? "请先登录Google账户以选择AI性格并开始聊天" 
                  : "Please sign in with your Google account to select an AI personality and start chatting"}
              </p>
              <Button
                onClick={signInWithGoogle}
                className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {language === "zh" ? "Google 登录" : "Google Sign In"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 dark:from-rose-950/20 dark:via-orange-950/20 dark:to-amber-950/20">
      <div className="container mx-auto max-w-4xl h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between py-6 border-b border-rose-200/50 dark:border-rose-800/30">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 bg-gradient-to-br ${
                currentPersonality.color === "rose"
                  ? "from-rose-400 to-pink-400"
                  : currentPersonality.color === "blue"
                    ? "from-blue-400 to-indigo-400"
                    : "from-amber-400 to-orange-400"
              } rounded-full flex items-center justify-center text-white`}
            >
              {currentPersonality.icon}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-rose-900 dark:text-rose-100 text-balance">
                {currentPersonality.name[language]}
              </h1>
              <p className="text-sm text-rose-600 dark:text-rose-300">{currentPersonality.description[language]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-2 mr-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || 'User'} />
                  <AvatarFallback className="text-xs bg-rose-500 text-white">
                    {user.user_metadata?.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-rose-700 dark:text-rose-300 hidden sm:inline truncate max-w-20">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}

            {!user && !loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={signInWithGoogle}
                className="mr-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent"
              >
                <LogIn className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{language === "zh" ? "登录" : "Sign In"}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent"
            >
              <Languages className="w-4 h-4 mr-2" />
              {language === "zh" ? "EN" : "中"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPersonalitySelector(true)}
              className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <Users className="w-4 h-4 mr-2" />
              {t.change}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={clearConversation}
              className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 bg-transparent"
            >
              {t.clear}
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loadingMessages && messages.length === 0 && (
            <div className="flex justify-center items-center py-8">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">
                  {language === "zh" ? "加载聊天记录中..." : "Loading chat history..."}
                </span>
              </div>
            </div>
          )}
          
          {!loadingMessages && messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.sender === "ai" && (
                <Avatar
                  className={`w-8 h-8 bg-gradient-to-br ${
                    currentPersonality.color === "rose"
                      ? "from-rose-400 to-pink-400"
                      : currentPersonality.color === "blue"
                        ? "from-blue-400 to-indigo-400"
                        : "from-amber-400 to-orange-400"
                  }`}
                >
                  <AvatarFallback className="text-white text-sm font-medium">AI</AvatarFallback>
                </Avatar>
              )}

              <Card
                className={`max-w-xs sm:max-w-md p-4 ${
                  message.sender === "user"
                    ? "bg-rose-500 text-white border-rose-500"
                    : "bg-white dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm leading-relaxed flex-1 ${
                      message.sender === "user" ? "text-white" : "text-rose-900 dark:text-rose-100"
                    }`}
                  >
                    {message.content}
                  </p>

                  {message.sender === "ai" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playAudio(message.id, message.content)}
                      disabled={loadingAudioId === message.id}
                      className="p-1 h-6 w-6 hover:bg-rose-100 dark:hover:bg-rose-800/50"
                    >
                      {loadingAudioId === message.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-rose-600 dark:text-rose-400" />
                      ) : playingMessageId === message.id ? (
                        <VolumeX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <Volume2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      )}
                    </Button>
                  )}
                </div>

                <p
                  className={`text-xs mt-2 ${
                    message.sender === "user" ? "text-rose-100" : "text-rose-500 dark:text-rose-400"
                  }`}
                >
                  {isMounted
                    ? message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
              </Card>

              {message.sender === "user" && user && (
                <Avatar className="w-8 h-8 bg-rose-600">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || 'User'} />
                  <AvatarFallback className="text-white text-sm font-medium">
                    {user.user_metadata?.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {!loadingMessages && isAITyping && (
            <div className="flex gap-3 justify-start">
              <Avatar
                className={`w-8 h-8 bg-gradient-to-br ${
                  currentPersonality.color === "rose"
                    ? "from-rose-400 to-pink-400"
                    : currentPersonality.color === "blue"
                      ? "from-blue-400 to-indigo-400"
                      : "from-amber-400 to-orange-400"
                }`}
              >
                <AvatarFallback className="text-white text-sm font-medium">AI</AvatarFallback>
              </Avatar>
              <Card className="bg-white dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-rose-200/50 dark:border-rose-800/30 bg-white/50 dark:bg-rose-950/20 backdrop-blur-sm">
          {!user ? (
            // 未登录时显示登录提示
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-medium text-rose-900 dark:text-rose-100 mb-2">
                {language === "zh" ? "请先登录" : "Please Sign In First"}
              </h3>
              <p className="text-sm text-rose-600 dark:text-rose-300 mb-4">
                {language === "zh" 
                  ? "使用Google账户登录后即可开始与AI聊天" 
                  : "Sign in with your Google account to start chatting with AI"}
              </p>
              <Button
                onClick={signInWithGoogle}
                className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {language === "zh" ? "Google 登录" : "Google Sign In"}
              </Button>
            </div>
          ) : (
            // 已登录时显示输入框
            <>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t.shareThoughts}
                    className="border-rose-200 dark:border-rose-800 focus:border-rose-400 dark:focus:border-rose-600 bg-white dark:bg-rose-950/50 text-rose-900 dark:text-rose-100 placeholder:text-rose-400 dark:placeholder:text-rose-500"
                    disabled={isAITyping || isRateLimited}
                  />
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isAITyping || isRateLimited}
                  className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white border-0 px-4 py-2"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-rose-500 dark:text-rose-400 mt-2 text-center">
                {isRateLimited ? t.rateLimit : t.pressEnter}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
