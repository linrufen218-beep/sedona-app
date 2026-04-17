import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AppSettings, saveRecord, getComponentState, saveComponentState, STORAGE_KEYS, WantType } from '@/lib/store';
import { analyzeEmotions } from '@/services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Heart, Settings2, Smile, Zap, Layers, Search, Loader2, RefreshCcw, ArrowRight, Save, ChevronLeft, LogOut } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const EMOTION_CATEGORIES = [
  { name: '万念俱灰', color: 'bg-slate-500', emotions: ['无聊', '赢不了', '冷淡', '被隔离', '沮丧', '绝望', '精疲力竭', '放弃', '麻木', '无能为力'] },
  { name: '悲苦', color: 'bg-blue-500', emotions: ['被遗弃', '被辱骂', '极度痛苦', '羞耻', '被背叛', '忧郁', '失望', '内疚', '心碎', '无助'] },
  { name: '恐惧', color: 'bg-purple-500', emotions: ['焦虑', '担忧', '不信任', '怀疑', '怯懦', '紧张', '恐慌', '偷偷摸摸', '多疑', '警惕'] },
  { name: '贪求', color: 'bg-orange-500', emotions: ['放纵', '期盼', '渴望', '嫉妒', '贪婪', '不耐烦', '吝啬', '占有欲强', '自私', '荒唐'] },
  { name: '愤怒', color: 'bg-red-500', emotions: ['生硬', '争强好斗', '恼怒', '好战', '刻薄', '挑衅', '暴躁', '憎恨', '敌意', '愤愤不平'] },
  { name: '自尊自傲', color: 'bg-yellow-600', emotions: ['无可指责', '自负', '固执', '自夸', '逞能', '轻蔑', '挑剔', '傲慢', '伪善', '虚伪'] },
  { name: '无畏', color: 'bg-emerald-500', emotions: ['爱冒险', '警觉', '活泼', '胸有成竹', '目标坚定', '快乐', '思路清楚', '慈悲', '自信', '勇敢'] },
  { name: '接纳', color: 'bg-teal-500', emotions: ['丰盛', '感激', '平衡', '美丽', '有归属感', '体贴', '高兴', '有同理心', '友好', '圆满'] },
  { name: '平静', color: 'bg-indigo-400', emotions: ['永不衰老', '有觉悟', '存在', '无边无际', '镇静', '完整', '不朽', '自由', '满足', '合一'] },
];

const RELEASE_MODES = [
  { id: 'emotion', title: '情绪释放', description: '针对特定情绪的快速释放。', icon: Smile, steps: ["你能允许{emo}存在吗？", "你能识别是哪种想要吗？", "你能允许自己放下它吗？"] }
];

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

export default function CustomRelease({ settings }: { settings?: AppSettings }) {
  const [phase, setPhase] = useState<'emotion_source' | 'emotion_select' | 'ai_analyze' | 'release' | 'post_release'>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.phase || 'emotion_source');
  const [selectedMode, setSelectedMode] = useState<any>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.selectedMode || RELEASE_MODES[0]);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.selectedEmotions || []);
  const [selectedWants, setSelectedWants] = useState<WantType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.selectedCategories || []);
  const [inputText, setInputText] = useState(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.inputText || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.aiAnalysis || null);
  const [stepIndex, setStepIndex] = useState(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.stepIndex || 0);
  const [releaseIndex, setReleaseIndex] = useState(0);
  const [isMerged, setIsMerged] = useState(false);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);
  const [releaseList, setReleaseList] = useState<{s: string, w: string[]}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.CUSTOM_STATE, {
      phase,
      selectedMode,
      selectedEmotions,
      selectedCategories,
      inputText,
      aiAnalysis,
      stepIndex
    });
  }, [phase, selectedMode, selectedEmotions, selectedCategories, inputText, aiAnalysis, stepIndex]);

  const startRelease = () => {
    let list: {s: string, w: string[]}[] = [];
    
    if (isMerged) {
      const mergedEmotions = selectedEmotions.join('、');
      const mergedWants = selectedWants.map(w => w === 'approval' ? '认可' : w === 'control' ? '控制' : '安全').join('、');
      list = [{ 
        s: `合并释放: ${mergedEmotions}${mergedEmotions && mergedWants ? ' & ' : ''}${mergedWants}`, 
        w: selectedWants 
      }];
    } else {
      // Individual emotions
      selectedEmotions.forEach(e => {
        list.push({ s: e, w: selectedWants });
      });
      // Individual wants if no emotions selected
      if (selectedEmotions.length === 0) {
        selectedWants.forEach(w => {
          list.push({ 
            s: w === 'approval' ? '想要被认可' : w === 'control' ? '想要控制' : '想要安全', 
            w: [w] 
          });
        });
      }
    }

    setReleaseList(list);
    setReleaseIndex(0);
    setStepIndex(0);
    setPhase('release');
  };

  const getButtonLabels = () => {
    const stepText = selectedMode.steps[stepIndex];
    
    if (selectedMode.id === 'emotion') {
      if (stepIndex === 0 || stepIndex === 1) return { primary: '能', secondary: '不能' };
      if (stepIndex === 2) return { primary: '允许', secondary: '不允许' };
    }

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

  const handleAiAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setPhase('ai_analyze');
    setAiAnalysis({ emo: [], cat: [], ana: '' });
    try {
      const result = await analyzeEmotions(
        inputText, 
        (partial) => {
          setAiAnalysis(partial);
          if (partial.emo) setSelectedEmotions(partial.emo);
          if (partial.cat) setSelectedCategories(partial.cat);
        },
        {
          model_type: settings.selectedModel
        }
      );
      setAiAnalysis(result);
      setSelectedEmotions(result.emo);
      setSelectedCategories(result.cat);

      // Auto save record after successful analysis
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'custom',
        content: `自定义释放分析: ${inputText.substring(0, 20)}...`,
        analysis: { list: [], ana: result.ana },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(error);
      alert('分析失败，请检查 Worker 配置或网络');
      setPhase('emotion_source');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const nextStep = () => {
    if (stepIndex < selectedMode.steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      if (releaseIndex < releaseList.length - 1) {
        setReleaseIndex(releaseIndex + 1);
        setStepIndex(0);
      } else {
        setPhase('post_release');
      }
    }
  };

  const finishAll = () => {
    handleManualSave();
    reset();
  };

  const handleManualSave = () => {
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'custom',
      content: `自定义释放: ${selectedMode?.title || ''} - ${selectedEmotions.join(', ')}`,
      analysis: aiAnalysis ? { list: [], ana: aiAnalysis.ana } : undefined,
      timestamp: Date.now()
    });
    alert('记录已手动保存');
  };

  const toggleWant = (want: WantType) => {
    if (selectedWants.includes(want)) {
      setSelectedWants(selectedWants.filter(w => w !== want));
    } else {
      setSelectedWants([...selectedWants, want]);
    }
  };

  const handleQuit = () => {
    if (phase === 'release') {
      setPhase(aiAnalysis ? 'ai_analyze' : 'emotion_select');
      setStepIndex(0);
      setReleaseIndex(0);
    }
  };

  const handleMoreRelease = () => {
    if (!moreReleaseEmotion.trim() || moreReleaseWants.length === 0) return;
    
    // Add to release list and start from there
    const newReleaseItem = {
      s: `(深入) ${moreReleaseEmotion}`,
      w: moreReleaseWants
    };
    
    setReleaseList([newReleaseItem]);
    setReleaseIndex(0);
    setStepIndex(0);
    setPhase('release');
    setMoreReleaseEmotion('');
    setMoreReleaseWants([]);
    setIsMoreReleaseOpen(false);
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const reset = () => {
    setPhase('emotion_source');
    setSelectedMode(RELEASE_MODES[0]);
    setSelectedEmotions([]);
    setSelectedWants([]);
    setSelectedCategories([]);
    setInputText('');
    setAiAnalysis(null);
    setStepIndex(0);
    setReleaseIndex(0);
    setReleaseList([]);
  };

  const toggleEmotion = (emotion: string, category: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotion));
    } else {
      setSelectedEmotions([...selectedEmotions, emotion]);
      if (!selectedCategories.includes(category)) {
        setSelectedCategories([...selectedCategories, category]);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {phase === 'emotion_source' && (
          <motion.div key="source" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-2xl mx-auto space-y-8">
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-serif">您想释放什么情绪？</CardTitle>
                <CardDescription>您可以直接选择，或让 AI 帮您分析。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 relative">
                  <Label>输入一段话让 AI 分析情绪</Label>
                  <Textarea 
                    placeholder="描述您现在的感受..." 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="h-32 bg-background/40"
                  />
                  <Button className="w-full bg-accent" onClick={handleAiAnalyze} disabled={!inputText.trim()}>
                    AI 情绪分析
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">或者</span></div>
                </div>
                <Button variant="outline" className="w-full h-14" onClick={() => setPhase('emotion_select')}>
                  <Search className="mr-2 w-4 h-4" /> 手动搜索/选择情绪
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === 'emotion_select' && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center gap-4 bg-card/60 p-4 rounded-2xl backdrop-blur-md sticky top-20 z-10 border border-border/20">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full"
                onClick={() => setPhase('emotion_source')}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-grow flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="搜索情绪 (如: 焦虑, 愤怒...)" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-none bg-transparent focus-visible:ring-0 text-lg"
                />
              </div>
              <div className="flex items-center gap-2 border-l border-border/30 pl-4">
                <Button 
                  variant={isMerged ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 text-[10px]"
                  onClick={() => setIsMerged(!isMerged)}
                >
                  {isMerged ? '合并释放' : '逐个释放'}
                </Button>
                <Button onClick={startRelease} disabled={selectedEmotions.length === 0 && selectedWants.length === 0} className="bg-primary">
                  开始释放 ({selectedEmotions.length + selectedWants.length})
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {selectedMode.id !== 'emotion' && (
                <div className="md:col-span-1 space-y-6">
                  <Card className="border-none bg-card/40 backdrop-blur-sm p-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-accent">释放三大想要</h4>
                    <div className="flex flex-col gap-2">
                      {(['approval', 'control', 'security'] as WantType[]).map((want) => (
                        <Button
                          key={want}
                          variant={selectedWants.includes(want) ? 'default' : 'outline'}
                          className={`justify-start text-xs h-10 ${selectedWants.includes(want) ? 'bg-accent' : ''}`}
                          onClick={() => toggleWant(want)}
                        >
                          {want === 'approval' ? '想要被认可' : want === 'control' ? '想要控制' : '想要安全'}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              <div className={selectedMode.id !== 'emotion' ? "md:col-span-3" : "md:col-span-4"}>
                <ScrollArea className="h-[600px] pr-4">
                  <div className={`grid grid-cols-1 ${selectedMode.id !== 'emotion' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
                    {EMOTION_CATEGORIES.map((cat) => (
                      <div key={cat.name} className="space-y-3">
                        <h4 className={`text-xs font-bold uppercase tracking-widest p-2 rounded-lg text-white ${cat.color}`}>{cat.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          {cat.emotions.filter(e => e.includes(searchTerm)).map((emo) => (
                            <Badge 
                              key={emo} 
                              variant={selectedEmotions.includes(emo) ? 'default' : 'outline'}
                              className={`cursor-pointer px-3 py-1.5 text-sm transition-all ${selectedEmotions.includes(emo) ? 'bg-accent scale-105' : 'hover:bg-accent/10'}`}
                              onClick={() => toggleEmotion(emo, cat.name)}
                            >
                              {emo}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'ai_analyze' && (
          <motion.div key="ai" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
            {isAnalyzing && !aiAnalysis ? (
              <div className="text-center py-20 space-y-6">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-accent" />
                <p className="font-serif text-xl">AI 正在深度觉察您的情绪...</p>
              </div>
            ) : (
              <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
                <CardHeader className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute left-4 top-4 rounded-full"
                    onClick={() => setPhase('emotion_source')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="pt-4 text-center">
                    <CardTitle className="text-2xl font-serif">AI 情绪觉察结果</CardTitle>
                    {isAnalyzing && <p className="text-[10px] text-accent animate-pulse">实时分析中...</p>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest opacity-60">识别出的情绪</Label>
                    <div className="flex flex-wrap gap-2 min-h-[24px]">
                      {aiAnalysis?.emo && aiAnalysis.emo.map((e: string) => <Badge key={e} className="bg-accent/20 text-accent border-none">{e}</Badge>)}
                      {isAnalyzing && !aiAnalysis?.emo?.length && <span className="text-xs text-muted-foreground animate-pulse">正在识别情绪...</span>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest opacity-60">所属大项</Label>
                    <div className="flex flex-wrap gap-2 min-h-[24px]">
                      {aiAnalysis?.cat && aiAnalysis.cat.map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
                      {isAnalyzing && !aiAnalysis?.cat?.length && <span className="text-xs text-muted-foreground animate-pulse">正在分类...</span>}
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-secondary/10 border border-secondary/20 italic leading-relaxed min-h-[100px]">
                    {aiAnalysis?.ana || (isAnalyzing && <span className="text-muted-foreground animate-pulse">AI 正在进行深层洞察...</span>)}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="secondary" className="flex-1" onClick={handleManualSave}>
                      <Save className="w-4 h-4 mr-2" /> 手动保存
                    </Button>
                    <Button 
                      className="flex-1 bg-primary" 
                      disabled={!aiAnalysis?.emo?.length} 
                      onClick={startRelease}
                    >
                      {isAnalyzing ? '分析中 (可先确认)' : '确认并释放'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {phase === 'release' && (
          <motion.div key="release" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-12 relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-0 top-0 text-muted-foreground hover:text-destructive"
              onClick={handleQuit}
            >
              <LogOut className="w-6 h-6" />
            </Button>

            <div className="space-y-4">
              <Badge variant="outline" className="px-4 py-1 border-accent text-accent">
                {selectedMode.title} ({releaseIndex + 1}/{releaseList.length})
              </Badge>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {releaseList[releaseIndex]?.w.map(w => (
                  <span key={w} className="text-[10px] text-accent uppercase font-bold">
                    #{w === 'approval' ? '认可' : w === 'control' ? '控制' : '安全'}
                  </span>
                ))}
              </div>
              <h2 className="text-[20px] font-serif leading-relaxed text-foreground px-6">
                {releaseList[releaseIndex]?.s}
              </h2>
              <p className="text-lg text-muted-foreground font-medium">
                {selectedMode.steps[stepIndex].replace('{emo}', releaseList[releaseIndex]?.s || '')}
              </p>
            </div>

            <div className="space-y-6 w-full max-w-sm">
              <Button size="lg" className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-accent text-primary-foreground shadow-lg transition-all active:scale-95" onClick={nextStep}>
                {getButtonLabels().primary}
              </Button>
              <Button variant="outline" className="w-full h-14 text-lg rounded-2xl border-border hover:bg-muted text-muted-foreground transition-all active:scale-95" onClick={nextStep}>
                {getButtonLabels().secondary}
              </Button>
            </div>

            <div className="flex gap-3">
              {selectedMode.steps.map((_: any, i: number) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${i === stepIndex ? 'bg-accent w-8' : 'bg-muted'}`} />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'post_release' && (
          <motion.div key="post" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center space-y-10 py-20">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <Smile className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-3xl font-serif">感觉好点了吗？</h2>
              <p className="text-muted-foreground">释放是一个持续的过程，您可以选择继续深入或完成本次旅程。</p>
            </div>

            <div className="flex flex-col gap-4">
              <Button size="lg" className="h-14 text-lg rounded-2xl bg-accent hover:bg-accent/80" onClick={() => { setStepIndex(0); setPhase('release'); }}>
                <RefreshCcw className="mr-2 w-5 h-5" /> 重新释放当前情绪
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-lg rounded-2xl border-border" onClick={() => setPhase('emotion_source')}>
                <ArrowRight className="mr-2 w-5 h-5" /> 继续释放其他情绪
              </Button>
              <Button 
                variant="ghost" 
                className="text-accent hover:text-accent/80 flex items-center gap-2 justify-center"
                onClick={() => setIsMoreReleaseOpen(true)}
              >
                <Zap className="w-4 h-4" /> 释放更多 (探索底层想要)
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-lg rounded-2xl border-border text-muted-foreground" onClick={finishAll}>
                完成并保存记录
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
