import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AppSettings, saveSettings } from '@/lib/store';
import { Settings as SettingsIcon, Save, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export default function Settings({ settings, onSettingsChange }: SettingsProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleModelChange = (value: AppSettings['selectedModel']) => {
    const newSettings = { ...settings, selectedModel: value };
    onSettingsChange(newSettings);
    saveSettings(newSettings);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <SettingsIcon className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-serif">AI 模型配置</CardTitle>
            </div>
            <CardDescription>选择默认使用的 AI 模型。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>当前模型</Label>
              <Select value={settings.selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full h-12 bg-background/40 border-border/40 rounded-xl">
                  <SelectValue placeholder="请选择模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mini">标准版 (mini)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek版 (deepseek)</SelectItem>
                  <SelectItem value="lite">轻量版 (lite)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showSuccess && (
              <p className="text-sm text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> 已应用模型设置
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card/40 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-lg font-serif">主题设置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {(['light', 'dark'] as const).map((t) => (
                <Button
                  key={t}
                  variant={settings.theme === t ? 'default' : 'outline'}
                  className="flex-1 capitalize"
                  onClick={() => {
                    const newSettings = { ...settings, theme: t };
                    onSettingsChange(newSettings);
                    saveSettings(newSettings);
                  }}
                >
                  {t === 'light' ? '明亮' : '深色'}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
