import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppSettings, saveRecord, addStuckSentence, getStuckSentences, removeStuckSentence, getComponentState, saveComponentState, STORAGE_KEYS, WantType } from '@/lib/store';
import { analyzeAreaAnswers, callAI } from '@/services/geminiService';
import { Loader2, Target, RefreshCcw, ChevronLeft, X, LogOut, MessageCircle, Trash2, Send, Smile, CheckCircle2, Save, Zap, HelpCircle, User, Plus, Circle, CheckCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const THEMES = [
  { 
    id: 'stuck', 
    title: '化解卡住', 
    description: '整合卡住课题、智能导师与问答挖掘。',
    questions: [] 
  },
  { 
    id: 'change', 
    title: '我想改变什么', 
    description: '列出生活中你想要改变的人、事、物。', 
    questions: [
      '列出生活中你想要改变的一些情况、人或问题。',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'suppress_express', 
    title: '压抑或表达', 
    description: '释放过去压抑或不当表达的情绪。', 
    questions: [
      '回忆一件我当时压抑情绪的具体事情。',
      '我现在对此有什么感受？',
      '回忆一件我当时表达情绪的具体事情。',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'success', 
    title: '成功', 
    description: '释放对成功或失败的执着。', 
    questions: [
      '想一想在你的生活中你想变得更成功的一个领域。',
      '如果成功，我现在的感受是什么？',
      '如果失败，我现在的感受是什么？'
    ] 
  },
  { 
    id: 'like_dislike', 
    title: '喜欢与不喜欢', 
    description: '释放对特定事物的极端好恶。', 
    questions: [
      '你现在关注的主题是什么？',
      '我喜欢该主题的哪些方面？',
      '我现在对此有什么感受？',
      '我不喜欢该主题的哪些方面？',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'must_do', 
    title: '我必须做的事', 
    description: '释放“不得不”的沉重感。', 
    questions: [
      '你觉得你必须做（不得不做）的事情是什么？',
      '我现在对此有什么感受？',
      '如果我不做这件事会怎样？',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'goal', 
    title: '目标释放', 
    description: '释放对结果的执着。', 
    questions: [
      '你的目标是什么？',
      '我对目标现在有什么感受？',
      '为了达成目标“我要做的事”是什么？',
      '我现在对每一件事有什么感受？'
    ] 
  },
  { 
    id: 'wants_awareness', 
    title: '觉察想要', 
    description: '识别行为背后的深层动机。', 
    questions: [
      '我寻求被认同的方式有哪些？',
      '我试图控制的方式有哪些？',
      '我寻求安全的方式有哪些？',
      '我现在对这些方式的感觉是什么？'
    ] 
  }
];

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

const SIX_STEPS = [
  "你必须想要‘波澜不惊’超过你想要‘被认可’、‘控制’或‘安全’吗？",
  "你决定通过释放来达到‘波澜不惊’吗？",
  "你能看到所有这些情绪感受都源自这三个想要吗？你能立即释放它们吗？",
  "你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？",
  "如果你现在感到‘卡住了’，你愿意放开对这个‘卡住’的想要控制吗？",
  "你现在感到更轻松、更快乐了一点吗？"
];

const EMOTION_STEPS = [
  "你允许这种感觉存在吗？",
  "你愿意让它离开吗？",
  "什么时候让它离开？"
];

const THREE_STEPS = [
  "你能允许这种感觉存在吗？",
  "你能识别是哪种想要吗？",
  "你能允许自己放下它吗？"
];

export default function FocusedRelease({ settings }: { settings?: AppSettings }) {
  const [selectedTheme, setSelectedTheme] = useState<any>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.selectedTheme || null);
  const [answers, setAnswers] = useState<string[]>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.answers || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.analysis || null);
  const [step, setStep] = useState<'list' | 'questions' | 'analysis' | 'release'>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.step || 'list');
  const [releaseIndex, setReleaseIndex] = useState(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.releaseIndex || 0);
  const [sixStepIndex, setSixStepIndex] = useState(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.sixStepIndex || 0);
  const [activeSteps, setActiveSteps] = useState<string[]>(SIX_STEPS);
  const [isSequential, setIsSequential] = useState(true);
  const [isSentenceFinished, setIsSentenceFinished] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [releasedIndices, setReleasedIndices] = useState<number[]>([]);
  const [skippedIndices, setSkippedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.skippedIndices || []);
  
  // Stuck section states
  const [stuckSentences, setStuckSentences] = useState<any[]>(getStuckSentences());
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.chatMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [stuckMode, setStuckMode] = useState<'none' | 'self' | 'qa'>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.stuckMode || 'none');
  const [manualStuckTopic, setManualStuckTopic] = useState('');
  const [selectedStuckIds, setSelectedStuckIds] = useState<string[]>([]);
  const [tempWants, setTempWants] = useState<WantType[]>([]);
  const [isWantSelectorOpen, setIsWantSelectorOpen] = useState(false);
  const [releaseMethod, setReleaseMethod] = useState<'three' | 'six' | 'emotions'>('six');
  const [isMergedRelease, setIsMergedRelease] = useState(false);

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.FOCUSED_STATE, {
      selectedTheme,
      answers,
      analysis,
      step,
      stuckMode,
      chatMessages,
      releaseIndex,
      releasedIndices,
      skippedIndices,
      sixStepIndex
    });
  }, [selectedTheme, answers, analysis, step, stuckMode, chatMessages, releaseIndex, releasedIndices, skippedIndices, sixStepIndex]);

  const startTheme = (theme: any) => {
    if (theme.id === 'stuck') {
      setStuckSentences(getStuckSentences());
      setStep('analysis');
      setSelectedTheme(theme);
      setStuckMode('none');
      return;
    }
    setSelectedTheme(theme);
    setAnswers(new Array(theme.questions.length).fill(''));
    setStep('questions');
  };

  const handleAddStuck = () => {
    if (!manualStuckTopic.trim()) return;
    addStuckSentence({
      text: manualStuckTopic,
      wants: tempWants,
      analysis: '手动添加的卡住课题',
      source: '手动添加'
    });
    setStuckSentences(getStuckSentences());
    setManualStuckTopic('');
    setTempWants([]);
    setIsWantSelectorOpen(false);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], w: [], sum: '' });
    try {
      const result = await analyzeAreaAnswers(
        selectedTheme.title, 
        selectedTheme.questions, 
        answers, 
        (partial) => {
          const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
          if (partial.list) {
            partial.list = partial.list.map((item: any, idx: number) => ({
              ...item,
              ans: answers[answeredIndices[idx]]
            }));
          }
          setAnalysis(partial);
        },
        {
          model_type: settings?.selectedModel || 'mini'
        }
      );
      
      // Merge user answers into the analysis list for display during release
      const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
      if (result.list) {
        result.list = result.list.map((item: any, idx: number) => ({
          ...item,
          ans: answers[answeredIndices[idx]]
        }));
      }
      
      setAnalysis(result);
      
      // Auto save record after successful analysis
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'focused',
        content: `${selectedTheme.title} 集中释放`,
        analysis: {
          list: result.list,
          ana: result.sum
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(error);
      alert('分析失败，请检查 Worker 配置或网络');
      setStep('questions');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRelease = (index: number, mode: 'sequential' | 'single') => {
    setStep('release');
    setReleaseIndex(index);
    setSixStepIndex(0);
    setIsSequential(mode === 'sequential');
    setIsSentenceFinished(false);
    if (mode === 'sequential') {
      setReleasedIndices([]);
      setSkippedIndices([]);
    }
    
    if (selectedTheme?.id === 'stuck') {
      if (releaseMethod === 'three') setActiveSteps(THREE_STEPS);
      else if (releaseMethod === 'emotions') setActiveSteps(EMOTION_STEPS);
      else setActiveSteps(SIX_STEPS);
    } else {
      if (mode === 'sequential' && index === 0) {
        setActiveSteps(SIX_STEPS);
      } else {
        setActiveSteps(THREE_STEPS);
      }
    }
  };

  const nextReleaseStep = () => {
    if (sixStepIndex < activeSteps.length - 1) {
      setSixStepIndex(sixStepIndex + 1);
    } else {
      setIsSentenceFinished(true);
    }
  };

  const continueRelease = () => {
    const isStuck = selectedTheme?.id === 'stuck';
    
    if (isStuck) {
      // Remove current sentence from stuck list
      const currentSentence = analysis.list[releaseIndex];
      if (currentSentence && currentSentence.id) {
        removeStuckSentence(currentSentence.id);
        const updatedStuck = getStuckSentences();
        setStuckSentences(updatedStuck);
        
        // Filter out released items from analysis.list
        const remainingInAnalysis = analysis.list.filter((_: any, i: number) => i !== releaseIndex);
        
        if (remainingInAnalysis.length === 0) {
          if (updatedStuck.length === 0) {
            reset();
            setStep('list');
          } else {
            setStep('analysis'); // Return to stuck list
            setAnalysis(null);
            setSelectedStuckIds([]);
            setStuckMode('none');
          }
          return;
        }
        
        const newAnalysis = {
          ...analysis,
          list: remainingInAnalysis
        };
        setAnalysis(newAnalysis);
        
        // Move to next index (looping)
        let nextIndex = releaseIndex;
        if (nextIndex >= newAnalysis.list.length) {
          nextIndex = 0;
        }
        
        setReleaseIndex(nextIndex);
        setSixStepIndex(0);
        setIsSentenceFinished(false);
        return;
      }
    }

    const newReleased = [...releasedIndices, releaseIndex];
    setReleasedIndices(newReleased);
    setIsSentenceFinished(false);
    if (isSequential && releaseIndex < analysis.list.length - 1) {
      setReleaseIndex(releaseIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(THREE_STEPS);
    } else {
      if (isSequential) {
        if (isAnalyzing) {
          setStep('analysis');
        } else {
          finishRelease();
        }
      } else {
        // Single release finished
        if (analysis.list.length > 0 && newReleased.length + skippedIndices.length === analysis.list.length) {
          if (isAnalyzing) {
            setStep('analysis');
          } else {
            finishRelease();
          }
        } else {
          setStep('analysis');
        }
      }
    }
  };

  const skipAndContinue = () => {
    const isStuck = selectedTheme?.id === 'stuck';
    if (isStuck) {
      let nextIndex = releaseIndex + 1;
      if (nextIndex >= analysis.list.length) {
        nextIndex = 0;
      }
      setReleaseIndex(nextIndex);
      setSixStepIndex(0);
      
      if (releaseMethod === 'three') setActiveSteps(THREE_STEPS);
      else if (releaseMethod === 'emotions') setActiveSteps(EMOTION_STEPS);
      else setActiveSteps(SIX_STEPS);
      
      setIsSentenceFinished(false);
    }
  };

  const reRelease = () => {
    setSixStepIndex(0);
    setIsSentenceFinished(false);
  };

  const skipSentence = () => {
    const isStuck = selectedTheme?.id === 'stuck';
    if (isStuck) {
      skipAndContinue();
      return;
    }

    const newSkipped = [...skippedIndices, releaseIndex];
    setSkippedIndices(newSkipped);
    if (isSequential && releaseIndex < analysis.list.length - 1) {
      setReleaseIndex(releaseIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(THREE_STEPS);
    } else {
      if (isSequential) {
        if (isAnalyzing) {
          setStep('analysis');
        } else {
          finishRelease();
        }
      } else {
        // Single release finished
        if (analysis.list.length > 0 && releasedIndices.length + newSkipped.length === analysis.list.length) {
          if (isAnalyzing) {
            setStep('analysis');
          } else {
            finishRelease();
          }
        } else {
          setStep('analysis');
        }
      }
    }
  };

  const handleQuit = (moveToStuck: boolean) => {
    if (moveToStuck) {
      const currentSentence = analysis.list[releaseIndex];
      addStuckSentence({
        text: currentSentence.s,
        wants: currentSentence.w || [],
        analysis: currentSentence.a,
        source: selectedTheme?.id === 'stuck' ? '化解卡住' : `${selectedTheme.title}集中释放`
      });
    }
    
    // Return to previous step
    if (selectedTheme?.id === 'stuck') {
      setStep('analysis');
      setStuckMode('none');
    } else {
      setStep('analysis');
    }
    
    setShowQuitDialog(false);
  };

  const toggleSentenceWant = (sentenceIndex: number, want: WantType) => {
    const newAnalysis = { ...analysis };
    const wants = [...(newAnalysis.list[sentenceIndex].w || [])];
    if (wants.includes(want)) {
      newAnalysis.list[sentenceIndex].w = wants.filter((w: string) => w !== want);
    } else {
      newAnalysis.list[sentenceIndex].w = [...wants, want];
    }
    setAnalysis(newAnalysis);
  };

  const removeSentence = (index: number) => {
    const newAnalysis = { ...analysis };
    newAnalysis.list.splice(index, 1);
    
    // Adjust released and skipped indices
    const newReleased = releasedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);
    const newSkipped = skippedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);
    
    setReleasedIndices(newReleased);
    setSkippedIndices(newSkipped);

    if (newAnalysis.list.length === 0) {
      reset();
    } else {
      setAnalysis(newAnalysis);
      // Check if all remaining are processed
      if (newAnalysis.list.length > 0 && newReleased.length + newSkipped.length === newAnalysis.list.length) {
        finishRelease();
      }
    }
  };

  const finishRelease = () => {
    handleManualSave();
    reset();
  };

  const handleManualSave = () => {
    if (!analysis) return;
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'focused',
      content: `${selectedTheme.title} 集中释放`,
      analysis: {
        list: analysis.list,
        ana: analysis.sum
      },
      timestamp: Date.now()
    });
    alert('记录已手动保存');
  };

  const reset = () => {
    setStep('list');
    setSelectedTheme(null);
    setAnalysis(null);
    setAnswers([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
    setChatMessages([]);
    setChatInput('');
  };

  const getStepContent = () => {
    const currentSentence = analysis?.list[releaseIndex];
    const wants = currentSentence?.w || [];
    const wantsText = wants.length > 0 
      ? wants.map((w: WantType) => WANT_LABELS[w] || '某种想要').join('、')
      : '某种想要';

    let stepText = activeSteps[sixStepIndex];

    if (activeSteps === THREE_STEPS) {
      if (sixStepIndex === 0) return `你能允许这种${wantsText}的感觉存在吗？`;
      if (sixStepIndex === 1) return `你能识别是哪种想要吗？(${wantsText})`;
      if (sixStepIndex === 2) return `你能允许自己放下它吗？`;
    }

    if (activeSteps === EMOTION_STEPS) {
      if (sixStepIndex === 0) return `你允许这种${wantsText}的感觉存在吗？`;
      if (sixStepIndex === 1) return `你愿意让它离开吗？`;
      if (sixStepIndex === 2) return `什么时候让它离开？`;
    }

    if (activeSteps === SIX_STEPS && sixStepIndex === 2) {
      return `你能看到所有这些情绪感受都源自这${wantsText}吗？你能立即释放它们吗？`;
    }

    return stepText;
  };

  const getButtonLabels = () => {
    const stepText = activeSteps[sixStepIndex];
    if (stepText.includes('允许') || stepText.includes('能')) {
      return { primary: '能 / 允许', secondary: '不能 / 不允许' };
    }
    if (stepText.includes('愿意')) {
      return { primary: '愿意', secondary: '不愿意' };
    }
    if (stepText.includes('什么时候')) {
      return { primary: '现在', secondary: '稍后 / 不知道' };
    }
    return { primary: '能 / 允许', secondary: '不能 / 不允许' };
  };

  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);

  const handleMoreRelease = (wants: WantType[], emotion?: string) => {
    // Update current sentence wants and restart release
    const newList = [...analysis.list];
    const current = newList[releaseIndex];
    newList[releaseIndex] = {
      ...current,
      s: emotion ? `${current.s} (感受: ${emotion})` : current.s,
      w: wants.length > 0 ? wants : current.w,
      a: `追溯分析: ${emotion ? `情绪[${emotion}] ` : ''}${wants.map(w => WANT_LABELS[w]).join('、')}`
    };
    setAnalysis({ ...analysis, list: newList });
    setSixStepIndex(0);
    setIsSentenceFinished(false);
    setIsMoreReleaseOpen(false);
    setMoreReleaseEmotion('');
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);
    
    const systemPrompt = "你是一个专业的瑟多纳释放法（Sedona Method）导师。你的目标是帮助用户化解他们在生活中感到的“卡住”或“胶着”的状态。请通过温和、觉察的提问，引导用户识别背后的“想要”（被认可、控制、安全、分离、合一），并引导他们进行释放。保持对话简洁、深刻且富有同理心。";
    
    try {
      let aiContent = '';
      setChatMessages(prev => [...prev, { role: 'ai', content: '' }]);
      
      const responseText = await callAI(
        `${systemPrompt}\n\n用户目前感到卡住的情况：${stuckSentences.map(s => s.text).join('; ')}\n\n用户说：${userMsg}`,
        (accumulated) => {
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'ai') {
              return [...prev.slice(0, -1), { role: 'ai', content: accumulated }];
            }
            return prev;
          });
        },
        {
          model_type: settings?.selectedModel || 'mini'
        }
      );
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last.role === 'ai') {
          return [...prev.slice(0, -1), { role: 'ai', content: responseText }];
        }
        return prev;
      });
    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'ai', content: '抱歉，我遇到了一些问题，请稍后再试。' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const deleteStuck = (id: string) => {
    removeStuckSentence(id);
    setStuckSentences(getStuckSentences());
  };

  const releaseStuck = (sentence: any) => {
    const currentStuck = getStuckSentences();
    // Use selected items if any, otherwise use the clicked one
    const targetIds = selectedStuckIds.length > 0 ? selectedStuckIds : [sentence.id];
    const targetItems = currentStuck.filter(s => targetIds.includes(s.id));
    
    if (isMergedRelease && targetItems.length > 1) {
      const mergedText = targetItems.map(s => s.text).join(' & ');
      const mergedWants = Array.from(new Set(targetItems.flatMap(s => s.wants || [])));
      setAnalysis({
        list: [{ s: mergedText, w: mergedWants, a: '合并释放多个课题', id: 'merged' }],
        sum: '合并专项释放'
      });
    } else {
      setAnalysis({
        list: targetItems.map(s => ({ s: s.text, w: s.wants || [], a: s.analysis, id: s.id })),
        sum: '针对卡住课题的专项释放'
      });
    }
    startRelease(0, 'sequential');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-1.5 md:px-2">
            {THEMES.map((theme) => (
              <Card 
                key={theme.id} 
                className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all border-none bg-card/60 backdrop-blur-sm group"
                onClick={() => startTheme(theme)}
              >
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="font-serif text-base md:text-lg flex items-center gap-2 group-hover:text-accent transition-colors">
                    <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    {theme.title}
                  </CardTitle>
                  <CardDescription className="text-[10px] md:text-xs leading-relaxed">{theme.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </motion.div>
        )}

        {step === 'questions' && (
          <motion.div key="questions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="text-center relative py-4 px-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-2 md:left-2 rounded-full h-8 w-8"
                  onClick={() => setStep('list')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-2">
                  <Badge variant="outline" className="w-fit mx-auto mb-1 border-accent text-accent text-[8px] md:text-[10px] py-0">{selectedTheme.title}</Badge>
                  <CardTitle className="font-serif text-lg md:text-2xl">请回答以下引导问句</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">您可以留空，直接进入分析。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-6">
                <ScrollArea className="h-[400px] md:h-[500px] pr-2 md:pr-4">
                  <div className="space-y-6 py-2">
                    {selectedTheme.questions.map((q: string, i: number) => (
                      <div key={i} className="space-y-2 relative">
                        <label className="text-[11px] md:text-xs font-medium text-foreground/80 leading-relaxed block">{i + 1}. {q}</label>
                        <Input 
                          value={answers[i]}
                          onChange={(e) => {
                            const newAnswers = [...answers];
                            newAnswers[i] = e.target.value;
                            setAnswers(newAnswers);
                          }}
                          placeholder="写下您的感受..."
                          className="h-10 md:h-12 bg-background/40 border-border/30 focus-visible:ring-accent text-[13px] md:text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-4 mt-6">
                  <Button className="flex-1 h-12 bg-primary hover:bg-accent text-primary-foreground text-sm" onClick={handleAnalyze} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCcw className="mr-2 w-4 h-4" />}
                    完成并在 AI 分析 (流式)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'analysis' && selectedTheme?.id === 'stuck' && (
          <motion.div key="stuck" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => { reset(); setStep('list'); }} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> 返回主题列表
              </Button>
              <Badge variant="outline" className="border-accent text-accent">化解卡住中心</Badge>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Plus className="w-4 h-4 text-accent" />
                    添加卡住课题
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="输入您感到卡住的主题..." 
                      value={manualStuckTopic}
                      onChange={(e) => setManualStuckTopic(e.target.value)}
                      className="h-12 bg-background/40"
                    />
                    <Popover open={isWantSelectorOpen} onOpenChange={setIsWantSelectorOpen}>
                      <PopoverTrigger render={
                        <Button size="icon" className="h-12 w-12 rounded-xl bg-primary hover:bg-accent" disabled={!manualStuckTopic.trim()}>
                          <Plus className="w-6 h-6" />
                        </Button>
                      } />
                      <PopoverContent className="w-56 p-2 bg-card/90 backdrop-blur-xl border-border/40">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">选择背后的想要 (可多选)</p>
                          <div className="space-y-1">
                            {(['approval', 'control', 'security'] as WantType[]).map((want) => (
                              <Button 
                                key={want} 
                                variant="ghost" 
                                className={`w-full justify-between text-xs h-9 ${tempWants.includes(want) ? 'bg-accent/20 text-accent' : ''}`}
                                onClick={() => {
                                  if (tempWants.includes(want)) {
                                    setTempWants(tempWants.filter(w => w !== want));
                                  } else {
                                    setTempWants([...tempWants, want]);
                                  }
                                }}
                              >
                                {want === 'approval' ? '想要被认可' : want === 'control' ? '想要控制' : '想要安全'}
                                {tempWants.includes(want) && <CheckCircle2 className="w-3 h-3" />}
                              </Button>
                            ))}
                          </div>
                          <Button 
                            className="w-full h-9 bg-primary hover:bg-accent text-primary-foreground text-xs"
                            onClick={handleAddStuck}
                          >
                            确认添加
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">卡住列表</CardTitle>
                  <CardDescription className="text-xs">选择一个课题进行释放。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {stuckSentences.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-xs italic">
                          列表为空
                        </div>
                      ) : (
                        stuckSentences.map((s) => (
                          <div 
                            key={s.id} 
                            onClick={() => {
                              if (selectedStuckIds.includes(s.id)) {
                                setSelectedStuckIds(selectedStuckIds.filter(id => id !== s.id));
                              } else {
                                setSelectedStuckIds([...selectedStuckIds, s.id]);
                              }
                              setStuckMode('none');
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex items-center gap-3 ${
                              selectedStuckIds.includes(s.id) ? 'bg-accent/10 border-accent' : 'bg-background/40 border-border/30 hover:border-accent/30'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {selectedStuckIds.includes(s.id) ? (
                                <CheckCircle className="w-5 h-5 text-accent" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/30" />
                              )}
                            </div>
                            <div className="flex-grow">
                              <p className="text-sm font-serif italic pr-8 line-clamp-2">"{s.text}"</p>
                              <div className="flex gap-1 mt-1">
                                {s.wants && s.wants.map((w: string) => (
                                  <Badge key={w} variant="outline" className="text-[8px] h-4 px-1 border-accent/30 text-accent/70">
                                    {w === 'approval' ? '认可' : w === 'control' ? '控制' : '安全'}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteStuck(s.id);
                                if (selectedStuckIds.includes(s.id)) {
                                  setSelectedStuckIds(selectedStuckIds.filter(id => id !== s.id));
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {selectedStuckIds.length > 0 && (
                    <div className="flex flex-col gap-4 pt-4 border-t border-border/30">
                      <div className="flex gap-3">
                        <Button 
                          variant={stuckMode === 'self' ? 'default' : 'outline'}
                          className="flex-1 h-12 gap-2"
                          onClick={() => setStuckMode('self')}
                        >
                          <User className="w-4 h-4" /> 自主释放
                        </Button>
                        <Button 
                          variant={stuckMode === 'qa' ? 'default' : 'outline'}
                          className="flex-1 h-12 gap-2"
                          disabled={selectedStuckIds.length > 1}
                          onClick={() => setStuckMode('qa')}
                        >
                          <HelpCircle className="w-4 h-4" /> 问答释放
                        </Button>
                      </div>

                      {stuckMode === 'self' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            {(['three', 'six', 'emotions'] as const).map((m) => (
                              <Button
                                key={m}
                                variant={releaseMethod === m ? 'secondary' : 'ghost'}
                                size="sm"
                                className="text-[10px] h-8"
                                onClick={() => setReleaseMethod(m)}
                              >
                                {m === 'three' ? '三步骤' : m === 'six' ? '六步骤' : '释放情绪'}
                              </Button>
                            ))}
                          </div>
                          
                          {selectedStuckIds.length > 1 && (
                            <div className="flex items-center justify-center gap-4 py-1 bg-accent/5 rounded-lg border border-accent/10">
                              <span className="text-[10px] text-muted-foreground">释放方式:</span>
                              <div className="flex gap-2">
                                <Button 
                                  variant={!isMergedRelease ? 'secondary' : 'ghost'} 
                                  size="sm" 
                                  className="h-6 text-[9px] px-2"
                                  onClick={() => setIsMergedRelease(false)}
                                >
                                  逐个释放
                                </Button>
                                <Button 
                                  variant={isMergedRelease ? 'secondary' : 'ghost'} 
                                  size="sm" 
                                  className="h-6 text-[9px] px-2"
                                  onClick={() => setIsMergedRelease(true)}
                                >
                                  合并释放
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          <Button 
                            className="w-full h-10 bg-accent hover:bg-accent/90 text-white text-xs font-bold shadow-lg shadow-accent/20"
                            onClick={() => releaseStuck(null)}
                          >
                            开始释放 ({selectedStuckIds.length}个课题)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {stuckMode === 'qa' && selectedStuckIds.length === 1 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        className="pt-6 space-y-6 border-t border-border/30 mt-6"
                      >
                        <div className="text-center space-y-4">
                          <div className="p-6 rounded-2xl bg-accent/5 border border-accent/10 max-w-md mx-auto">
                            <p className="text-lg font-serif italic">"{stuckSentences.find(s => s.id === selectedStuckIds[0])?.text}"</p>
                          </div>
                          <p className="text-sm text-muted-foreground">通过深度问答挖掘潜意识中的阻碍。</p>
                          <Button 
                            size="lg" 
                            className="h-14 px-10 rounded-full bg-accent hover:bg-accent/80 text-accent-foreground shadow-xl transition-all gap-2"
                            onClick={() => {
                              const s = stuckSentences.find(s => s.id === selectedStuckIds[0]);
                              if (!s) return;
                              setSelectedTheme({
                                id: 'stuck_digging',
                                title: '问答挖掘',
                                questions: [
                                  '你现在感到卡住的主题是什么？',
                                  '这件事对我有什么好处？',
                                  '这件事对我有什么坏处？',
                                  '我现在对此的感觉是什么？'
                                ]
                              });
                              setAnswers([s.text, '', '', '']);
                              setStep('questions');
                            }}
                          >
                            <HelpCircle className="w-5 h-5" /> 进入问答挖掘
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {step === 'analysis' && selectedTheme?.id !== 'stuck' && analysis && (
          <motion.div key="analysis" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="relative py-4 md:py-6 px-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-2 md:left-4 md:top-4 rounded-full h-8 w-8"
                  onClick={() => setStep('questions')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-2 px-6 md:pt-4 md:px-8">
                  <CardTitle className="font-serif text-lg md:text-2xl">执念深度剖析</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">针对每个回答挖掘潜意识“想要”，点击“+”调整。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-8 px-3 md:px-6 pb-6">
                <div className="flex flex-col gap-3">
                  <Button 
                    className="w-full h-11 md:h-12 bg-primary hover:bg-accent text-primary-foreground shadow-lg gap-2 text-sm" 
                    onClick={() => startRelease(0, 'sequential')}
                    disabled={!analysis.list || analysis.list.length === 0}
                  >
                    <RefreshCcw className="w-4 h-4" /> {isAnalyzing ? '开始释放 (同步分析中...)' : '开始释放 (全部顺序)'}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 md:gap-3">
                  {analysis.w && analysis.w.map((w: string) => (
                    <Badge key={w} className="bg-accent/20 text-accent border-none px-2.5 md:px-4 py-1.5 text-[10px] md:text-sm">
                      {WANT_LABELS[w as WantType] || w}
                    </Badge>
                  ))}
                </div>

                <ScrollArea className="h-[300px] md:h-[350px] pr-2 md:pr-4">
                  <div className="space-y-4">
                    {analysis.list && analysis.list.map((item: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border border-border/30 space-y-2 relative group ${releasedIndices.includes(i) ? 'opacity-50 bg-muted/20' : 'bg-background/40'}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] md:text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">第 {i + 1} 点</span>
                            {releasedIndices.includes(i) && <Badge variant="outline" className="text-[8px] h-4 px-1 border-green-500 text-green-500">已释放</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-1 items-center">
                            {item.w && item.w.map((w: WantType) => (
                              <Badge key={w} variant="secondary" className="bg-secondary/20 text-foreground border-none px-1.5 py-0 text-[8px] flex items-center gap-1">
                                {WANT_LABELS[w]}
                                <X className="w-2 h-2 cursor-pointer hover:text-destructive" onClick={() => toggleSentenceWant(i, w)} />
                              </Badge>
                            ))}
                            <Popover>
                              <PopoverTrigger render={
                                <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full bg-primary/10 hover:bg-primary/20">
                                  <Plus className="w-2.5 h-2.5" />
                                </Button>
                              } />
                              <PopoverContent className="w-36 p-1.5 bg-popover/95 backdrop-blur-sm border-border/50">
                                <div className="flex flex-col gap-0.5">
                                  {(Object.keys(WANT_LABELS) as WantType[]).map((w) => (
                                    <Button 
                                      key={w} 
                                      variant="ghost" 
                                      size="sm" 
                                      className={`justify-start font-normal text-[10px] h-7 ${item.w && item.w.includes(w) ? 'bg-accent/20 text-accent' : ''}`}
                                      onClick={() => toggleSentenceWant(i, w)}
                                    >
                                      {WANT_LABELS[w]}
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <p className="text-[10px] md:text-xs text-muted-foreground/60 leading-tight">Q: {item.s}</p>
                        <p className="text-[13px] md:text-sm text-foreground/90 leading-snug font-serif italic">"{item.ans || '未回答'}"</p>
                        
                        {item.a && (
                          <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                            <p className="text-[11px] md:text-[12px] text-muted-foreground leading-relaxed">
                              <span className="font-bold text-accent mr-1 uppercase text-[9px] tracking-tight">潜意识解析:</span> {item.a}
                            </p>
                          </div>
                        )}
                        <div className="pt-1 flex gap-2">
                          <Button size="sm" variant="outline" className="flex-[2] h-9 border-accent/30 text-accent hover:bg-accent/10 text-[11px] md:text-xs gap-2" onClick={() => startRelease(i, 'single')}>
                            <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" /> 快速释放
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-border/30 hover:bg-muted text-muted-foreground rounded-xl h-9 text-[11px] md:text-xs"
                            onClick={() => removeSentence(i)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ))}
                    {isAnalyzing && (
                      <div className="p-5 rounded-2xl bg-accent/5 border border-dashed border-accent/20 animate-pulse flex items-center justify-center h-24">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                          <p className="text-[10px] text-accent font-medium">AI 深度分析中...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 md:p-6 rounded-2xl bg-secondary/10 border border-secondary/20 leading-relaxed text-xs md:text-base text-foreground/90 italic">
                  <h4 className="font-bold text-[10px] md:text-sm mb-2 text-secondary-foreground flex items-center gap-2 uppercase tracking-wide not-italic">
                    <RefreshCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> 执念根底深度总结
                  </h4>
                  {isAnalyzing && (!analysis.sum || analysis.sum.length < 5) ? (
                    <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在深度提炼整体执念...</span>
                    </div>
                  ) : (
                    analysis.sum
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-accent/30 hover:bg-accent/10 text-xs md:text-sm" onClick={handleManualSave}>
                    <Save className="w-4 h-4 mr-2" /> 手动保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'release' && analysis && (
          <motion.div key="release" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[85vh] md:min-h-[70vh] text-center space-y-6 md:space-y-12 relative px-4 py-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1 md:right-0 md:top-0 text-muted-foreground hover:text-destructive"
              onClick={() => setShowQuitDialog(true)}
            >
              <LogOut className="w-6 h-6" />
            </Button>

            <div className="space-y-4 md:space-y-6 max-w-xl">
              <Badge variant="outline" className="px-3 md:px-4 py-1 border-accent text-accent text-[9px] md:text-sm">
                要点 {releaseIndex + 1} / {analysis.list.length}
              </Badge>
              <div className="flex flex-wrap justify-center gap-1">
                {analysis.list[releaseIndex].w && analysis.list[releaseIndex].w.map((w: WantType) => (
                  <Badge key={w} variant="secondary" className="bg-accent/10 text-accent border-none px-2 py-0.5 text-[9px] md:text-[10px]">
                    {WANT_LABELS[w]}
                  </Badge>
                ))}
              </div>
              <h2 className="text-[17px] md:text-[20px] font-serif leading-tight text-foreground px-2 text-center">
                "{analysis.list[releaseIndex].s}"
              </h2>
              {analysis.list[releaseIndex].ans && (
                <p className="text-[11px] md:text-sm text-muted-foreground italic line-clamp-2 px-4 shadow-sm bg-accent/5 py-1 rounded-lg">您的回答: {analysis.list[releaseIndex].ans}</p>
              )}
              {analysis.list[releaseIndex].a && (
                <div className="text-[10px] md:text-[12px] text-muted-foreground bg-background/50 p-3 rounded-xl border border-border/20 shadow-sm max-w-sm mx-auto">
                   <span className="font-bold text-accent mr-1 uppercase text-[8px] block mb-1">潜意识解析</span>
                  {analysis.list[releaseIndex].a}
                </div>
              )}
            </div>

            <div className="space-y-8 md:space-y-10 w-full max-w-sm md:max-w-md bg-card/40 p-6 md:p-8 rounded-3xl backdrop-blur-sm border border-border/20 shadow-2xl">
              <AnimatePresence mode="wait">
                {!isSentenceFinished ? (
                  <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 md:space-y-10">
                    <div className="space-y-1 md:space-y-2">
                      <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-widest">
                        {releaseMethod === 'six' ? '六步骤' : releaseMethod === 'three' ? '三步骤' : '情绪三步'} - Step {sixStepIndex + 1}
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.div key={sixStepIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-[17px] md:text-lg font-medium text-foreground leading-snug min-h-[70px] flex items-center justify-center px-4">
                          {getStepContent()}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-col gap-3 md:gap-4">
                      <Button size="lg" className="h-12 md:h-14 text-base md:text-lg rounded-2xl bg-primary hover:bg-accent text-primary-foreground shadow-lg transition-all" onClick={nextReleaseStep}>
                        {getButtonLabels().primary}
                      </Button>
                      <Button variant="outline" className="h-12 md:h-14 text-base md:text-lg rounded-2xl border-border hover:bg-muted text-muted-foreground transition-all" onClick={nextReleaseStep}>
                        {getButtonLabels().secondary}
                      </Button>
                      <button 
                        className="text-[10px] text-muted-foreground hover:text-accent transition-colors underline underline-offset-4"
                        onClick={skipSentence}
                      >
                        先不释放，跳到下一句
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="choice" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 md:space-y-8">
                    <div className="space-y-1">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                      </div>
                      <h3 className="text-lg md:text-xl font-medium">本点释放完成</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">您感觉如何？</p>
                    </div>
                    <div className="flex flex-col gap-2 md:gap-3">
                      <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base" onClick={continueRelease}>
                        继续释放下一课题
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base"
                        onClick={() => setIsMoreReleaseOpen(true)}
                      >
                        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> 释放更多 (探索底层想要)
                      </Button>
                      
                      {selectedTheme?.id === 'stuck' && (
                        <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-border text-muted-foreground hover:bg-muted text-sm md:text-base" onClick={skipAndContinue}>
                          先跳过这一个
                        </Button>
                      )}
                      <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base" onClick={reRelease}>
                        重新释放本句
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2.5 md:gap-3">
              {activeSteps.map((_, i) => (
                <div key={i} className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-500 ${i === sixStepIndex ? 'bg-accent w-6 md:w-8' : 'bg-muted'}`} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认退出本句释放？</DialogTitle>
            <DialogDescription>
              您可以选择将本句移动到“化解卡住”板块，或者直接返回。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleQuit(false)}>
              直接返回
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/80" onClick={() => handleQuit(true)}>
              移动到“化解卡住”并返回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isMoreReleaseOpen} onOpenChange={setIsMoreReleaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Zap className="w-5 h-5 text-accent" /> 释放更多
            </DialogTitle>
            <DialogDescription>
              深入挖掘当前感受背后的底层想要。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>现在的感受/情绪是什么？</Label>
              <Input 
                placeholder="例如：感到隐约的焦虑、不知所措..." 
                value={moreReleaseEmotion}
                onChange={(e) => setMoreReleaseEmotion(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>这背后对应哪些“想要”？</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WANT_LABELS) as WantType[]).map(w => (
                  <Button
                    key={w}
                    variant={moreReleaseWants.includes(w) ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-full ${moreReleaseWants.includes(w) ? 'bg-accent hover:bg-accent/90' : ''}`}
                    onClick={() => toggleMoreWant(w)}
                  >
                    {WANT_LABELS[w]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl"
              disabled={!moreReleaseEmotion.trim() || moreReleaseWants.length === 0}
              onClick={() => handleMoreRelease(moreReleaseWants, moreReleaseEmotion)}
            >
              开始深入分析释放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
