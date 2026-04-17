import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getHistory, getHarvests, saveHarvest, ReleaseRecord, HarvestRecord } from '@/lib/store';
import { Calendar as CalendarIcon, BookOpen, Trash2, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';

export default function History() {
  const [history, setHistory] = useState<ReleaseRecord[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [newHarvest, setNewHarvest] = useState('');
  const [isAddingHarvest, setIsAddingHarvest] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
    setHarvests(getHarvests());
  }, []);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const dayRecords = history.filter(r => r.date === dateStr);
  const dayHarvests = harvests.filter(h => h.date === dateStr);

  const handleAddHarvest = () => {
    if (!newHarvest.trim() || !selectedDate) return;
    const harvest: HarvestRecord = {
      id: crypto.randomUUID(),
      date: dateStr,
      content: newHarvest,
      timestamp: Date.now()
    };
    saveHarvest(harvest);
    setHarvests([harvest, ...harvests]);
    setNewHarvest('');
    setIsAddingHarvest(false);
  };

  const clearHistory = () => {
    if (confirm('确定要清空所有历史记录和收获本吗？')) {
      localStorage.removeItem('sedona_history');
      localStorage.removeItem('sedona_harvests');
      setHistory([]);
      setHarvests([]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Calendar */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={zhCN}
            className="rounded-xl"
            classNames={{
              day_selected: "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              day_today: "bg-primary/20 text-primary font-bold",
            }}
          />
        </Card>

        <Card className="border-none shadow-xl bg-secondary/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-secondary-foreground" />
              今日收获本
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {dayHarvests.map((h) => (
                <motion.div 
                  key={h.id} 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="p-3 rounded-lg bg-background/40 border border-border/20 text-sm leading-relaxed"
                >
                  <Sparkles className="w-3 h-3 text-accent inline mr-2" />
                  {h.content}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isAddingHarvest ? (
              <div className="space-y-3 pt-2">
                <Textarea 
                  value={newHarvest} 
                  onChange={(e) => setNewHarvest(e.target.value)}
                  placeholder="记录今天的感悟、进步或美好的瞬间..."
                  className="text-sm bg-background/50"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-accent" onClick={handleAddHarvest}>保存</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingHarvest(false)}>取消</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/10" onClick={() => setIsAddingHarvest(true)}>
                <Plus className="w-4 h-4 mr-2" /> 记录新收获
              </Button>
            )}
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={clearHistory}>
          <Trash2 className="w-4 h-4 mr-2" /> 清空所有记录
        </Button>
      </div>

      {/* Right: Records */}
      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[20px] font-serif flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-primary" />
            {dateStr} 的释放记录
          </h2>
          <Badge variant="secondary" className="bg-primary/20 text-primary border-none">
            {dayRecords.length} 条记录
          </Badge>
        </div>

        <ScrollArea className="h-[700px] pr-4">
          <div className="space-y-6">
            {dayRecords.length === 0 ? (
              <div className="text-center py-20 opacity-40">
                <CalendarIcon className="w-16 h-16 mx-auto mb-4" />
                <p>这一天没有释放记录</p>
              </div>
            ) : (
              dayRecords.map((record) => (
                <Card key={record.id} className="border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden group">
                  <div className="h-1 bg-primary/30 group-hover:bg-accent transition-colors" />
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-secondary/20 text-secondary-foreground border-none">
                        {record.type === 'daily' ? '日常释放' : record.type === 'area' ? '领域释放' : record.type === 'focused' ? '集中释放' : '自定义'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{format(record.timestamp, 'HH:mm')}</span>
                    </div>
                    <CardTitle className="text-lg font-serif mt-2 line-clamp-2">
                      {record.content}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {record.analysis && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-background/40 border border-border/20 text-sm leading-relaxed italic opacity-80">
                          {record.analysis.ana || record.analysis.sum || record.analysis.deepAnalysis}
                        </div>
                        {record.analysis.supplement && (
                          <div className="text-xs text-muted-foreground border-l-2 border-accent pl-3 py-1">
                            补充: {record.analysis.supplement}
                          </div>
                        )}
                      </div>
                    )}
                    <Dialog>
                      <DialogTrigger render={
                        <Button variant="ghost" size="sm" className="w-full text-primary hover:text-accent group">
                          查看详情 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      } />
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/50">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-2xl">{record.content}</DialogTitle>
                          <DialogDescription>{format(record.timestamp, 'yyyy年MM月dd日 HH:mm')}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-8 py-6">
                          {(record.analysis?.list || record.analysis?.sentences) && (
                            <div className="space-y-4">
                              <h4 className="font-bold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> 逐句分析</h4>
                              <div className="space-y-3">
                                {(record.analysis.list || record.analysis.sentences).map((s: any, i: number) => (
                                  <div key={i} className="p-4 rounded-xl bg-background/50 border border-border/30">
                                    <p className="text-sm italic mb-2">"{s.s || s.text}"</p>
                                    {s.a && <p className="text-xs text-muted-foreground mb-3 bg-accent/5 p-2 rounded-lg border border-accent/10">{s.a}</p>}
                                    <div className="flex flex-wrap gap-2">
                                      {(s.w || s.wants).map((w: string) => (
                                        <Badge key={w} variant="outline" className="text-[10px] uppercase border-accent/30 text-accent">
                                          {w}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-4">
                            <h4 className="font-bold text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" /> 深层洞察</h4>
                            <p className="text-sm leading-relaxed text-foreground/80 bg-secondary/5 p-6 rounded-2xl border border-secondary/10">
                              {record.analysis?.ana || record.analysis?.sum || record.analysis?.deepAnalysis}
                            </p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
