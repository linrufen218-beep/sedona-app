import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { AppSettings, saveRecord, addStuckSentence, getComponentState, saveComponentState, STORAGE_KEYS, WantType } from '@/lib/store';
import { analyzeAreaAnswers } from '@/services/geminiService';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, RefreshCcw, X, LogOut, Save, Zap, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const AREAS = [
  {
    id: 'wealth',
    title: '财富',
    description: '释放关于金钱、事业和匮乏感的执念。',
    questions: [
      '你贪恋金钱的哪些方面？我现在对它的感觉是什么？',
      '你厌恶金钱的哪些方面？我现在对它的感觉是什么？',
      '你生活中金钱跟想要控制的关联。我现在对它的感觉是什么？',
      '你生活中金钱跟想要认同的关联。我现在对它的感觉是什么？',
      '你生活中金钱跟想要安全的关联。我现在对它的感觉是什么？',
      '想象你的财富状况已经达到你完美预期。我现在对它的感觉是什么？',
      '想象你的财富状况永远达不到完美预期。我现在对它的感觉是什么？',
      '想象你永远都只有一点点钱。我现在对它的感觉是什么？',
      '想象从财富中彻底自由。我现在对它的感觉是什么？',
      '想象在这个世界里完全不用钱生活。我现在对它的感觉是什么？'
    ]
  },
  {
    id: 'relationship',
    title: '人际关系',
    description: '释放关于爱、归属感和他人评价的执念。',
    questions: [
      '你贪恋人际关系的哪些方面？我现在对它的感觉是什么？',
      '你厌恶人际关系的哪些方面？我现在对它的感觉是什么？',
      '你生活中人际关系跟想要控制的关联。我现在对它的感觉是什么？',
      '你生活中人际关系跟想要认同的关联。我现在对它的感觉是什么？',
      '你生活中人际关系跟想要安全的关联。我现在对它的感觉是什么？',
      '在人际关系中我是支配者吗？我现在对它的感觉是什么？',
      '在人际关系中我是被支配者吗？我现在对它的感觉是什么？',
      '人际关系中有哪些琐事。我现在对此的感觉是什么？',
      '我在什么时候感觉跟对方是分离的。我现在对此的感觉是什么？',
      '我在什么时候感觉跟对方一体的。我现在对此的感觉是什么？',
      '我认为这个人和我的关系有什么特殊性吗？我现在对此的感觉是什么？'
    ]
  },
  {
    id: 'appearance',
    title: '外貌',
    description: '释放关于身体形象和自我认同的执念。',
    questions: [
      '你贪恋外貌的哪些方面？我现在对它的感觉是什么？',
      '你厌恶外貌的哪些方面？我现在对它的感觉是什么？',
      '我的外貌跟想要控制的关联。我现在对它的感觉是什么？',
      '我的外貌跟想要认同的关联。我现在对它的感觉是什么？',
      '我的外貌跟想要安全的关联。我现在对它的感觉是什么？',
      '我的外貌与我的关系（比如：我的外貌代表我吗？）。我现在对此的感觉是什么？'
    ]
  },
  {
    id: 'sex',
    title: '性',
    description: '释放关于欲望、羞耻感和亲密关系的执念。',
    questions: [
      '性跟想要控制的关联。我现在对此的感觉是什么？',
      '性跟想要认同的关联。我现在对此的感觉是什么？',
      '性跟想要安全的关联。我现在对此的感觉是什么？',
      '你觉得性与快乐是什么关系？现在对此的感觉是什么？',
      '想象你彻底摆脱性的束缚。现在对此的感觉是什么？',
      '想象你再也不会有性。现在对此的感觉是什么？',
      '我能放下对我是这具身体的认同吗？现在对此的感觉是什么？'
    ]
  }
];

const SIX_STEPS = [
  "你必须想要‘波澜不惊’超过你想要‘被认可’、‘控制’或‘安全’吗？",
  "你决定通过释放来达到‘波澜不惊’吗？",
  "你能看到所有这些情绪感受都源自这三个想要吗？你能立即释放它们吗？",
  "你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？",
  "如果你现在感到‘卡住了’，你愿意放开对这个‘卡住’的想要控制吗？",
  "你现在感到更轻松、更快乐了一点吗？"
];

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

const THREE_STEPS = [
  "你允许这种感觉存在吗？",
  "你能识别出这是哪种‘想要’吗？",
  "你允许自己放下它吗？"
];

export default function AreaRelease({ settings }: { settings?: AppSettings }) {
  const [selectedArea, setSelectedArea] = useState<any>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.selectedArea || null);
  const [answers, setAnswers] = useState<string[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.answers || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.analysis || null);
  const [step, setStep] = useState<'list' | 'questions' | 'analysis' | 'release'>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.step || 'list');
  const [releaseIndex, setReleaseIndex] = useState(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.releaseIndex || 0);
  const [sixStepIndex, setSixStepIndex] = useState(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.sixStepIndex || 0);

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
    return { primary: '是的 / 决定了', secondary: '暂时不能 / 跳过' };
  };

  const [activeSteps, setActiveSteps] = useState<string[]>(SIX_STEPS);
  const [isSequential, setIsSequential] = useState(true);
  const [isSentenceFinished, setIsSentenceFinished] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [releasedIndices, setReleasedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.releasedIndices || []);
  const [skippedIndices, setSkippedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.skippedIndices || []);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.AREA_STATE, {
      selectedArea,
      answers,
      analysis,
      step,
      releaseIndex,
      releasedIndices,
      skippedIndices,
      sixStepIndex
    });
  }, [selectedArea, answers, analysis, step, releaseIndex, releasedIndices, skippedIndices, sixStepIndex]);

  const startArea = (area: any) => {
    setSelectedArea(area);
    setAnswers(new Array(area.questions.length).fill(''));
    setStep('questions');
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], w: [], sum: '' });
    setReleasedIndices([]);
    setSkippedIndices([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
    try {
      const result = await analyzeAreaAnswers(
        selectedArea.title, 
        selectedArea.questions, 
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
          model_type: settings.selectedModel
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
        type: 'area',
        content: `${selectedArea.title} 领域释放`,
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
    if (mode === 'sequential' && index === 0) {
      setActiveSteps(SIX_STEPS);
    } else {
      setActiveSteps(THREE_STEPS);
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

  const reRelease = () => {
    setSixStepIndex(0);
    setIsSentenceFinished(false);
  };

  const handleMoreRelease = () => {
    if (!moreReleaseEmotion.trim() || moreReleaseWants.length === 0) return;
    
    const newAnalysis = { ...analysis };
    newAnalysis.list[releaseIndex] = {
      ...newAnalysis.list[releaseIndex],
      s: `(深入) ${moreReleaseEmotion}`,
      w: moreReleaseWants,
      a: `针对“${moreReleaseEmotion}”的进一步释放`
    };
    
    setAnalysis(newAnalysis);
    setMoreReleaseEmotion('');
    setMoreReleaseWants([]);
    setIsMoreReleaseOpen(false);
    reRelease();
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const skipSentence = () => {
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
      analysis.list.forEach((s: any, i: number) => {
        if (!releasedIndices.includes(i)) {
          addStuckSentence({
            text: s.s,
            wants: [],
            analysis: s.a,
            source: `${selectedArea.title}领域释放`
          });
        }
      });
    }
    reset();
    setShowQuitDialog(false);
  };

  const toggleWant = (sentenceIndex: number, want: WantType) => {
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
      type: 'area',
      content: `${selectedArea.title} 领域释放`,
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
    setSelectedArea(null);
    setAnalysis(null);
    setAnswers([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-1.5 md:px-2">
            {AREAS.map((area) => (
              <Card 
                key={area.id} 
                className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all border-none bg-card/60 backdrop-blur-sm group"
                onClick={() => startArea(area)}
              >
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="font-serif text-base md:text-lg group-hover:text-accent transition-colors">{area.title}</CardTitle>
                  <CardDescription className="text-[10px] md:text-xs leading-relaxed">{area.description}</CardDescription>
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
                  <Badge variant="outline" className="w-fit mx-auto mb-1 border-accent text-accent text-[8px] md:text-[10px] py-0">{selectedArea.title}领域</Badge>
                  <CardTitle className="font-serif text-lg md:text-2xl">请回答以下引导问句</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">您可以直接在下方填写感受，也可以留空。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-6">
                <ScrollArea className="h-[400px] md:h-[500px] pr-2 md:pr-4">
                  <div className="space-y-6 py-2">
                    {selectedArea.questions.map((q: string, i: number) => (
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
                    完成分析 (流式)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'analysis' && analysis && (
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
                  <CardTitle className="font-serif text-lg md:text-2xl">领域执念深度分析</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">AI 深度解析执念根源。点击“+”调整想要。</CardDescription>
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
                                <X className="w-2 h-2 cursor-pointer hover:text-destructive" onClick={() => toggleWant(i, w)} />
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
                                      onClick={() => toggleWant(i, w)}
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
                问题 {releaseIndex + 1} / {analysis.list.length}
              </Badge>
              <h2 className="text-[17px] md:text-[20px] font-serif leading-tight text-foreground px-2">
                "{analysis.list[releaseIndex].s}"
              </h2>
              <p className="text-[12px] md:text-sm text-muted-foreground italic line-clamp-2 px-4">您的回答: {analysis.list[releaseIndex].ans}</p>
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
                        {activeSteps.length === 6 ? '六步骤' : '三步骤'} - Step {sixStepIndex + 1}
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.div key={sixStepIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-[17px] md:text-lg font-medium text-foreground leading-snug min-h-[70px] flex items-center justify-center px-2">
                          {activeSteps[sixStepIndex]}
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
                        继续释放下一个问题
                      </Button>
                      <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base" onClick={reRelease}>
                        重新释放本句
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-accent hover:text-accent/80 flex items-center gap-2 text-[11px] md:text-sm h-8 md:h-10"
                        onClick={() => setIsMoreReleaseOpen(true)}
                      >
                        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> 释放更多 (探索底层想要)
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
            <DialogTitle>确认退出释放？</DialogTitle>
            <DialogDescription>
              您还有未完成释放的句子。是否需要将这些句子移动到“化解卡住”板块，以便日后处理？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleQuit(false)}>
              直接退出
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/80" onClick={() => handleQuit(true)}>
              移动到“化解卡住”并退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoreReleaseOpen} onOpenChange={setIsMoreReleaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
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
              onClick={handleMoreRelease}
            >
              开始深入分析释放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
