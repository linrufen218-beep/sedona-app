import parse from 'partial-json-parser';

// 配置：Cloudflare Worker 地址
const WORKER_URL = 'https://sodona.linrufen218.workers.dev/'; 

function safeJSONParse(text: string) {
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (e) {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let targetText = text;
    if (jsonMatch && jsonMatch[1]) {
      targetText = jsonMatch[1];
      try {
        return JSON.parse(targetText);
      } catch (e2) {}
    }
    
    const firstBrace = targetText.indexOf('{');
    if (firstBrace !== -1) {
      const jsonCandidate = targetText.substring(firstBrace);
      try {
        const lastBrace = jsonCandidate.lastIndexOf('}');
        if (lastBrace !== -1) {
          try {
            const full = JSON.parse(jsonCandidate.substring(0, lastBrace + 1));
            return full;
          } catch (e3) {}
        }
        const partial = parse(jsonCandidate);
        
        // 如果是列表模式，过滤掉最后一个可能极度不完整的对象
        if (partial && typeof partial === 'object' && Array.isArray(partial.list)) {
          // 如果 list 最后一个元素没有任何有用字段，则剔除
          if (partial.list.length > 0) {
            const lastItem = partial.list[partial.list.length - 1];
            // 简单的启发式：如果只有 1 个键或者没有键，且正在流式传输中，可能还没写到关键内容
            if (Object.keys(lastItem).length <= 1) {
              partial.list.pop();
            }
          }
        }
        
        return partial;
      } catch (e4) {
        for (let i = jsonCandidate.length - 1; i >= 0; i--) {
          if (jsonCandidate[i] === '}' || jsonCandidate[i] === ']') {
            try {
              return parse(jsonCandidate.substring(0, i + 1));
            } catch (e5) {
              continue;
            }
          }
        }
      }
    }
    
    throw new Error('无法解析 AI 返回的 JSON 数据。');
  }
}

export async function callAI(
  prompt: string, 
  onProgress?: (text: string) => void,
  options?: { model_type?: string }
) {
  if (!WORKER_URL) {
    throw new Error('请在 geminiService.ts 中配置 WORKER_URL 地址。');
  }

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: prompt,
      model_type: options?.model_type || 'mini',
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`Worker Error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流。');

  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    let lineEnd;
    while ((lineEnd = buffer.indexOf('\n')) !== -1) {
      const line = buffer.substring(0, lineEnd).trim();
      buffer = buffer.substring(lineEnd + 1);

      if (line.startsWith('data: ')) {
        const dataStr = line.substring(6).trim();
        if (dataStr === '[DONE]') break;
        try {
          const data = JSON.parse(dataStr);
          const content = data.choices?.[0]?.delta?.content || "";
          accumulated += content;
          if (onProgress) onProgress(accumulated);
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }
  }

  return accumulated;
}

export async function analyzeReleaseText(
  text: string, 
  onProgress?: (data: any) => void,
  options?: { model_type?: string }
) {
  const prompt = `导师指令：分析文本并拆分为释放清单。
    输入：${text}
    要求：
    1. 必须完整处理所有内容，不可遗漏。
    2. 深度分析：不要重复句子说了什么，而要挖掘该陈述背后潜意识蕴含的“想要”（认可、控制、安全）。
    3. “想要”仅限 [approval, control, security]。
    4. 每句的分析（a）应约50字左右，直指执念核心。
    5. 核心总结（ana）约80字。
    
    输出必须是纯JSON格式：
    {
      "list": [
        { "s": "原始句子", "w": ["approval"], "a": "潜意识挖掘分析" }
      ],
      "ana": "整体执念总结"
    }`;

  const responseText = await callAI(prompt, (accumulated) => {
    if (onProgress) {
      try {
        const partialData = safeJSONParse(accumulated);
        onProgress(partialData);
      } catch (e) {
        // 忽略解析中间状态失败
      }
    }
  }, options);

  const result = safeJSONParse(responseText || "");
  if (onProgress) onProgress(result);
  return result;
}

export async function analyzeAreaAnswers(
  area: string, 
  questions: string[], 
  answers: string[], 
  onProgress?: (data: any) => void,
  options?: { model_type?: string }
) {
  const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
  const answeredQuestions = answeredIndices.map(i => questions[i]);
  const answeredAnswers = answeredIndices.map(i => answers[i]);

  const prompt = `导师指令：深度分析“${area}”回答中蕴含的执念。
    对照：
    ${answeredQuestions.map((q, i) => `Q:${q}\nA:${answeredAnswers[i]}`).join('\n')}
    
    要求：
    1. 必须遍历所有Q&A。
    2. 分析焦点：挖掘每个回答背后隐藏的“想要”（认可、控制、安全）。分析应揭示行为和思想背后的情感钩子，而非描述表面内容。
    3. “想要”仅限 [approval, control, security]。
    4. 每个回答的分析（a）应约50字左右。
    5. 核心总结（sum）约80字。
    
    输出必须是纯JSON格式：
    {
      "list": [
        { "s": "对应的回答内容", "w": ["approval"], "a": "潜意识想要深度分析" }
      ],
      "w": ["核心想要"],
      "sum": "整体执念深度总结"
    }`;

  const responseText = await callAI(prompt, (accumulated) => {
    if (onProgress) {
      try {
        const partialData = safeJSONParse(accumulated);
        onProgress(partialData);
      } catch (e) {}
    }
  }, options);

  const result = safeJSONParse(responseText || "");
  if (onProgress) onProgress(result);
  return result;
}

export async function analyzeEmotions(
  text: string, 
  onProgress?: (data: any) => void,
  options?: { model_type?: string }
) {
  const prompt = `导师指令：分析情绪类别与根源想要。
    输入：${text}
    类别：[万念俱灰, 悲苦, 恐惧, 贪求, 愤怒, 自尊自傲, 无畏, 接纳, 平静]
    要求：
    1. 深度分析背后的心理动机和想要，控制在80字左右。
    
    输出必须是纯JSON格式：
    {
      "emo": ["具体情绪"],
      "cat": ["情绪类别"],
      "ana": "底层想要与根源分析"
    }`;

  const responseText = await callAI(prompt, (accumulated) => {
    if (onProgress) {
      try {
        const partialData = safeJSONParse(accumulated);
        onProgress(partialData);
      } catch (e) {}
    }
  }, options);

  const result = safeJSONParse(responseText || "");
  if (onProgress) onProgress(result);
  return result;
}
