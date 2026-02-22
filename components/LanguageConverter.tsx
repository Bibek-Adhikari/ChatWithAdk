import React, { useState, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { 
  ArrowLeftRight, 
  Copy, 
  Check, 
  AlertCircle,
  Loader2,
  Sparkles,
  Download,
  RefreshCw,
  Eye,
  Code2,
  Shield,
  Zap,
  Brain,
  GitBranch,
  Workflow,
  RotateCcw
} from 'lucide-react';
import { cn } from './VSCodeCompiler'; // Import your cn utility

// --- Types ---
type SourceLanguage = 'javascript' | 'typescript' | 'python' | 'rust' | 'go' | 'java' | 'csharp' | 'php' | 'ruby' | 'kotlin';
type TargetLanguage = SourceLanguage;

interface ConversionResult {
  success: boolean;
  code: string;
  errors?: string[];
  warnings?: string[];
  confidence?: number;
  explanation?: string;
}

interface ConversionHistory {
  id: string;
  sourceLang: SourceLanguage;
  targetLang: TargetLanguage;
  sourceCode: string;
  targetCode: string;
  timestamp: Date;
}

// Language pairs with special handling
const LANGUAGE_PAIRS: Record<string, { name: string, icon: string, color: string }> = {
  'javascript': { name: 'JavaScript', icon: '📜', color: 'text-yellow-400' },
  'typescript': { name: 'TypeScript', icon: '📘', color: 'text-blue-400' },
  'python': { name: 'Python', icon: '🐍', color: 'text-green-400' },
  'rust': { name: 'Rust', icon: '🦀', color: 'text-orange-400' },
  'go': { name: 'Go', icon: '🐹', color: 'text-cyan-400' },
  'java': { name: 'Java', icon: '☕', color: 'text-red-400' },
  'csharp': { name: 'C#', icon: '🎯', color: 'text-purple-400' },
  'php': { name: 'PHP', icon: '🐘', color: 'text-indigo-400' },
  'ruby': { name: 'Ruby', icon: '💎', color: 'text-pink-400' },
  'kotlin': { name: 'Kotlin', icon: '💜', color: 'text-violet-400' }
};

// Conversion templates for common patterns
const CONVERSION_PATTERNS: Record<string, any> = {
  'javascript:typescript': {
    patterns: [
      { from: /function\s+(\w+)\s*\(([^)]*)\)\s*{/g, to: 'function $1($2): any {' },
      { from: /const\s+(\w+)\s*=\s*{/g, to: 'interface I$1 {\\n  // TODO: Add types\\n}\\n\\nconst $1: I$1 = {' },
      { from: /(\w+)\s*=\s*\(([^)]*)\)\s*=>/g, to: 'const $1 = ($2): any =>' }
    ],
    addTypes: true
  },
  'python:rust': {
    patterns: [
      { from: /def\s+(\w+)\s*\(([^)]*)\):/g, to: 'fn $1($2) {\\n    // TODO: Add return type\\n}' },
      { from: /print\((.*)\)/g, to: 'println!("{}", $1);' },
      { from: /#(.*)/g, to: '//$1' }
    ]
  },
  'javascript:python': {
    patterns: [
      { from: /function\s+(\w+)\s*\(([^)]*)\)\s*{/g, to: 'def $1($2):' },
      { from: /const\s+(\w+)\s*=\s*/g, to: '$1 = ' },
      { from: /let\s+(\w+)\s*=\s*/g, to: '$1 = ' },
      { from: /var\s+(\w+)\s*=\s*/g, to: '$1 = ' },
      { from: /console\.log\((.*)\)/g, to: 'print($1)' },
      { from: /\/\/(.*)/g, to: '#$1' },
      { from: /}\s*$/gm, to: '' }
    ]
  },
  'python:javascript': {
    patterns: [
      { from: /def\s+(\w+)\s*\(([^)]*)\):/g, to: 'function $1($2) {' },
      { from: /print\((.*)\)/g, to: 'console.log($1)' },
      { from: /#(.*)/g, to: '//$1' },
      { from: /if\s+(.*):/g, to: 'if ($1) {' },
      { from: /else:/g, to: 'else {' },
      { from: /elif\s+(.*):/g, to: 'else if ($1) {' }
    ]
  }
};

// Example code templates
const EXAMPLE_CODE = {
  'javascript': `// JavaScript Example
function calculateTotal(items) {
  return items
    .filter(item => item.price > 0)
    .reduce((sum, item) => sum + item.price, 0);
}

const cart = [
  { name: "Laptop", price: 999 },
  { name: "Mouse", price: 25 }
];

console.log(calculateTotal(cart));`,

  'typescript': `// TypeScript Example
interface Item {
  name: string;
  price: number;
}

function calculateTotal(items: Item[]): number {
  return items
    .filter((item: Item) => item.price > 0)
    .reduce((sum: number, item: Item) => sum + item.price, 0);
}

const cart: Item[] = [
  { name: "Laptop", price: 999 },
  { name: "Mouse", price: 25 }
];

console.log(calculateTotal(cart));`,

  'python': `# Python Example
def calculate_total(items):
    return sum(item['price'] for item in items if item['price'] > 0)

cart = [
    {"name": "Laptop", "price": 999},
    {"name": "Mouse", "price": 25}
]

print(calculate_total(cart))`,

  'rust': `// Rust Example
struct Item {
    name: String,
    price: i32,
}

fn calculate_total(items: &[Item]) -> i32 {
    items.iter()
        .filter(|item| item.price > 0)
        .map(|item| item.price)
        .sum()
}

fn main() {
    let cart = vec![
        Item { name: "Laptop".to_string(), price: 999 },
        Item { name: "Mouse".to_string(), price: 25 },
    ];
    
    println!("{}", calculate_total(&cart));
}`,

  'go': `// Go Example
package main

import "fmt"

type Item struct {
	Name  string
	Price float64
}

func calculateTotal(items []Item) float64 {
	sum := 0.0
	for _, item := range items {
		if item.Price > 0 {
			sum += item.Price
		}
	}
	return sum
}

func main() {
	cart := []Item{
		{Name: "Laptop", Price: 999},
		{Name: "Mouse", Price: 25},
	}
	fmt.Println(calculateTotal(cart))
}`,

  'java': `// Java Example
import java.util.*;

class Main {
    static class Item {
        String name;
        double price;
        Item(String n, double p) { name = n; price = p; }
    }

    public static double calculateTotal(List<Item> items) {
        return items.stream()
            .filter(i -> i.price > 0)
            .mapToDouble(i -> i.price)
            .sum();
    }

    public static void main(String[] args) {
        List<Item> cart = Arrays.asList(
            new Item("Laptop", 999),
            new Item("Mouse", 25)
        );
        System.out.println(calculateTotal(cart));
    }
}`,

  'csharp': `// C# Example
using System;
using System.Collections.Generic;
using System.Linq;

class Program {
    class Item {
        public string Name { get; set; }
        public double Price { get; set; }
    }

    static double CalculateTotal(List<Item> items) {
        return items.Where(i => i.Price > 0).Sum(i => i.Price);
    }

    static void Main() {
        var cart = new List<Item> {
            new Item { Name = "Laptop", Price = 999 },
            new Item { Name = "Mouse", Price = 25 }
        };
        Console.WriteLine(CalculateTotal(cart));
    }
}`,

  'php': `<?php
// PHP Example
$cart = [
    ["name" => "Laptop", "price" => 999],
    ["name" => "Mouse", "price" => 25]
];

function calculate_total($items) {
    return array_sum(array_column(array_filter($items, function($i) {
        return $i['price'] > 0;
    }), 'price'));
}

echo calculate_total($cart);`,

  'ruby': `# Ruby Example
cart = [
  { name: "Laptop", price: 999 },
  { name: "Mouse", price: 25 }
]

def calculate_total(items)
  items.select { |i| i[:price] > 0 }
       .map { |i| i[:price] }
       .sum
end

puts calculate_total(cart)`,

  'kotlin': `// Kotlin Example
data class Item(val name: String, val price: Double)

fun calculateTotal(items: List<Item>): Double {
    return items.filter { it.price > 0 }
                .sumOf { it.price }
}

fun main() {
    val cart = listOf(
        Item("Laptop", 999.0),
        Item("Mouse", 25.0)
    )
    println(calculateTotal(cart))
}`
};

interface LanguageConverterProps {
  onClose?: () => void;
  theme?: string;
}

export default function LanguageConverter({ onClose, theme = 'vs-dark' }: LanguageConverterProps) {
  // State
  const [sourceLang, setSourceLang] = useState<SourceLanguage>('javascript');
  const [targetLang, setTargetLang] = useState<TargetLanguage>('typescript');
  const [sourceCode, setSourceCode] = useState(EXAMPLE_CODE['javascript']);
  const [targetCode, setTargetCode] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [conversionMode, setConversionMode] = useState<'smart' | 'strict' | 'pattern'>('smart');
  const [history, setHistory] = useState<ConversionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [autoConvert, setAutoConvert] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);

  // Refs
  const sourceEditorRef = React.useRef<any>(null);
  const targetEditorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);

  // Handle source editor mount
  const handleSourceMount: OnMount = (editor, monaco) => {
    sourceEditorRef.current = editor;
    monacoRef.current = monaco;

    // Add custom syntax highlighting rules
    monaco.languages.registerCompletionItemProvider(sourceLang, {
      provideCompletionItems: () => ({
        suggestions: getLanguageSuggestions(sourceLang, monaco)
      })
    });
  };

  // Handle target editor mount
  const handleTargetMount: OnMount = (editor, monaco) => {
    targetEditorRef.current = editor;
  };

  // Get language-specific suggestions
  const getLanguageSuggestions = (lang: SourceLanguage, monaco: any) => {
    const suggestions = [];
    
    if (lang === 'javascript' || lang === 'typescript') {
      suggestions.push(
        {
          label: 'function',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'function ${1:name}(${2:params}) {\n\t${3}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a function'
        },
        {
          label: 'arrow',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'const ${1:name} = (${2:params}) => {\n\t${3}\n};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create an arrow function'
        }
      );
    }
    
    return suggestions;
  };

  // Swap languages
  const swapLanguages = () => {
    setSourceLang(targetLang as SourceLanguage);
    setTargetLang(sourceLang);
    setSourceCode(targetCode || EXAMPLE_CODE[targetLang as keyof typeof EXAMPLE_CODE] || '');
    setTargetCode(sourceCode);
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load example
  const loadExample = () => {
    setSourceCode(EXAMPLE_CODE[sourceLang]);
    setTargetCode('');
    setConversionResult(null);
  };

  // Basic pattern-based conversion
  const convertWithPatterns = (code: string, from: SourceLanguage, to: TargetLanguage): string => {
    const key = `${from}:${to}`;
    const patterns = CONVERSION_PATTERNS[key];
    
    if (!patterns) return `// Direct conversion from ${from} to ${to} not yet implemented\n// Using basic template\n\n${code}`;

    let converted = code;
    patterns.patterns.forEach((pattern: any) => {
      // Handle \n in replacement strings
      const to = pattern.to.replace(/\\n/g, '\n');
      converted = converted.replace(pattern.from, to);
    });

    return converted;
  };

  // Smart conversion using Express backend API
  const smartConvert = async (code: string, from: SourceLanguage, to: TargetLanguage): Promise<ConversionResult> => {
    try {
      setConversionProgress(20);

      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          sourceLanguage: from,
          targetLanguage: to
        })
      });

      setConversionProgress(70);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server conversion failed');
      }

      setConversionProgress(90);

      return {
        success: true,
        code: data.code,
        confidence: data.confidence || 95,
        explanation: `Converted via Express backend using ${data.model || 'Gemini AI'}.`
      };
    } catch (error: any) {
      console.error('Smart Conversion Error:', error);
      // Fallback to pattern-based conversion
      const fallbackCode = convertWithPatterns(code, from, to);
      return {
        success: true,
        code: fallbackCode,
        confidence: 60,
        explanation: `AI conversion failed (${error.message}). Used pattern-based fallback.`
      };
    } finally {
      setConversionProgress(100);
    }
  };

  // Generate smart conversion (simulated - in real app, this would be an API call)
  const generateSmartConversion = (code: string, from: SourceLanguage, to: TargetLanguage): string => {
    if (from === 'javascript' && to === 'typescript') {
      return code
        .replace(/function\s+(\w+)\s*\(([^)]*)\)/g, 'function $1($2): any')
        .replace(/const\s+(\w+)\s*=/g, 'const $1: any =')
        .replace(/console\.log\((.*)\)/g, 'console.log($1 as any)');
    }
    
    if (from === 'python' && to === 'rust') {
      return `// Converted from Python to Rust
${code
  .replace(/def\s+(\w+)\s*\(([^)]*)\):/g, 'fn $1($2) {\n    // TODO: Add implementation\n}')
  .replace(/print\((.*)\)/g, 'println!("{}", $1);')
  .replace(/#(.*)/g, '//$1')}`;
    }

    return convertWithPatterns(code, from, to);
  };

  // Main conversion function
  const convertCode = async () => {
    if (!sourceCode.trim()) return;
    
    setIsConverting(true);
    setConversionProgress(0);
    setConversionResult(null);

    try {
      let result: ConversionResult;

      if (conversionMode === 'smart') {
        result = await smartConvert(sourceCode, sourceLang, targetLang);
      } else {
        // Use pattern-based conversion
        const converted = convertWithPatterns(sourceCode, sourceLang, targetLang);
        result = {
          success: true,
          code: converted,
          confidence: conversionMode === 'strict' ? 100 : 80
        };
      }

      setTargetCode(result.code);
      setConversionResult(result);

      // Add to history
      setHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        sourceLang,
        targetLang,
        sourceCode,
        targetCode: result.code,
        timestamp: new Date()
      }, ...prev].slice(0, 10)); // Keep last 10

    } catch (error: any) {
      setConversionResult({
        success: false,
        code: '',
        errors: [error.message]
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Auto-convert on code change with debounce
  useEffect(() => {
    if (autoConvert && sourceCode.trim() && !isConverting) {
      const timeout = setTimeout(convertCode, 1000);
      return () => clearTimeout(timeout);
    }
  }, [sourceCode, autoConvert, sourceLang, targetLang]);

  // Handle source language change - load example automatically
  useEffect(() => {
    // Only auto-load if current code is empty or matches another example
    const isCurrentExample = Object.values(EXAMPLE_CODE).some(code => code.trim() === sourceCode.trim());
    if (!sourceCode.trim() || isCurrentExample) {
      setSourceCode(EXAMPLE_CODE[sourceLang] || '');
      setTargetCode('');
    }
  }, [sourceLang]);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300">
      {/* Header */}
      <div className="h-14 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-blue-500/10">
            <img src="/assets/logo.webp" alt="ConverterAdk" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-bold text-white"></h1>
          
 <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-xs font-bold transition-all border border-blue-500/20"
            >
              <ArrowLeftRight size={16} className="rotate-180" />
              Back to ChatAdk
            </button>
            </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoConvert(!autoConvert)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              autoConvert 
                ? "bg-green-600/20 text-green-400 border border-green-500/30" 
                : "bg-[#1e1e1e] text-gray-400 border border-[#333] hover:bg-[#2d2d2d]"
            )}
          >
            <Zap size={14} />
            Auto
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e] text-gray-400 rounded-lg border border-[#333] hover:bg-[#2d2d2d] text-xs font-bold transition-all"
          >
            <GitBranch size={14} />
            History
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {showHistory ? (
          // History Panel
          <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase text-gray-500">Conversion History</h2>
              <button
                onClick={() => setHistory([])}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                Clear All
              </button>
            </div>
            
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
                <p>No conversion history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#252526] rounded-lg p-4 border border-[#333] hover:border-purple-500/30 cursor-pointer transition-all"
                    onClick={() => {
                      setSourceLang(item.sourceLang);
                      setTargetLang(item.targetLang);
                      setSourceCode(item.sourceCode);
                      setTargetCode(item.targetCode);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xl", LANGUAGE_PAIRS[item.sourceLang].color)}>
                          {LANGUAGE_PAIRS[item.sourceLang].icon}
                        </span>
                        <span className="text-sm font-bold">{LANGUAGE_PAIRS[item.sourceLang].name}</span>
                        <ArrowLeftRight size={14} className="text-gray-600" />
                        <span className={cn("text-xl", LANGUAGE_PAIRS[item.targetLang].color)}>
                          {LANGUAGE_PAIRS[item.targetLang].icon}
                        </span>
                        <span className="text-sm font-bold">{LANGUAGE_PAIRS[item.targetLang].name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{item.sourceCode.slice(0, 100)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Converter UI
          <div className="h-full flex flex-col lg:flex-row">
            {/* Source Editor */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-[#333]">
              <div className="h-10 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <select
                    value={sourceLang}
                    onChange={(e) => {
                      setSourceLang(e.target.value as SourceLanguage);
                      if (autoConvert) setTimeout(convertCode, 500);
                    }}
                    className="bg-[#1e1e1e] text-xs font-bold px-2 py-1 rounded border border-[#333] focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(LANGUAGE_PAIRS).map(([key, { name, icon }]) => (
                      <option key={key} value={key}>{icon} {name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-600">Source</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={loadExample}
                    className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white"
                    title="Load Example"
                  >
                    <Code2 size={16} />
                  </button>
                  <button
                    onClick={() => copyToClipboard(sourceCode)}
                    className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white"
                    title="Copy Source"
                  >
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={sourceLang}
                  value={sourceCode}
                  onChange={(value) => setSourceCode(value || '')}
                  theme={theme}
                  onMount={handleSourceMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 10 }
                  }}
                />
              </div>
            </div>

            {/* Converter Controls */}
            <div className="lg:w-16 bg-[#252526] flex lg:flex-col items-center justify-center gap-4 p-4 border-y lg:border-x border-[#333]">
              <button
                onClick={swapLanguages}
                className="p-2 bg-[#1e1e1e] hover:bg-[#2d2d2d] rounded-lg text-blue-400 transition-all hover:scale-110 active:scale-95 border border-[#333] group"
                title="Swap Languages"
              >
                <ArrowLeftRight size={20} className="group-hover:rotate-180 transition-transform duration-500" />
              </button>
              
              <button
                onClick={convertCode}
                disabled={isConverting || !sourceCode.trim()}
                className={cn(
                  "p-3 rounded-xl font-bold transition-all relative overflow-hidden",
                  isConverting || !sourceCode.trim()
                    ? "bg-gray-600/50 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95"
                )}
                title="Convert"
              >
                {isConverting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Sparkles size={20} />
                )}
              </button>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  showAdvanced ? "bg-purple-600/20 text-purple-400" : "bg-[#1e1e1e] text-gray-400 hover:text-white"
                )}
                title="Advanced Options"
              >
                <Brain size={18} />
              </button>
            </div>

            {/* Target Editor */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-10 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as TargetLanguage)}
                    className="bg-[#1e1e1e] text-xs font-bold px-2 py-1 rounded border border-[#333] focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(LANGUAGE_PAIRS).map(([key, { name, icon }]) => (
                      <option key={key} value={key}>{icon} {name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-600">Target</span>
                </div>
                <div className="flex items-center gap-2">
                  {conversionResult?.confidence && (
                    <span className="text-xs text-gray-400">
                      Confidence: {conversionResult.confidence}%
                    </span>
                  )}
                  <button
                    onClick={() => copyToClipboard(targetCode)}
                    className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white"
                    disabled={!targetCode}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([targetCode], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `converted.${targetLang}`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white"
                    disabled={!targetCode}
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 relative">
                <Editor
                  height="100%"
                  language={targetLang}
                  value={targetCode}
                  theme={theme}
                  onMount={handleTargetMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: true,
                    padding: { top: 10 }
                  }}
                />

                {/* Conversion Progress Overlay */}
                {isConverting && (
                  <div className="absolute inset-0 bg-[#1e1e1e]/80 flex items-center justify-center backdrop-blur-sm">
                    <div className="text-center">
                      <Loader2 size={40} className="animate-spin text-purple-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 mb-2">Converting...</p>
                      <div className="w-48 h-1 bg-[#333] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 transition-all duration-300"
                          style={{ width: `${conversionProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Options Panel */}
      {showAdvanced && !showHistory && (
        <div className="h-32 bg-[#252526] border-t border-[#333] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase text-gray-500">Advanced Options</h3>
            <button
              onClick={() => setShowAdvanced(false)}
              className="text-gray-500 hover:text-white"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="flex gap-6">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Conversion Mode</label>
              <div className="flex gap-2">
                {(['smart', 'strict', 'pattern'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setConversionMode(mode)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                      conversionMode === mode
                        ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                        : "bg-[#1e1e1e] text-gray-400 border border-[#333] hover:bg-[#2d2d2d]"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-2">Type Safety</label>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-[#1e1e1e] text-gray-400 rounded-lg border border-[#333] text-xs font-bold">
                  <Shield size={14} className="inline mr-1" /> Strict
                </button>
                <button className="px-3 py-1.5 bg-[#1e1e1e] text-gray-400 rounded-lg border border-[#333] text-xs font-bold">
                  <Zap size={14} className="inline mr-1" /> Infer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error/Warning Panel */}
      {conversionResult?.errors && conversionResult.errors.length > 0 && (
        <div className="bg-red-900/20 border-t border-red-800 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-400 mb-1">Conversion Errors:</p>
              {conversionResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-300">{err}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {conversionResult?.warnings && conversionResult.warnings.length > 0 && (
        <div className="bg-yellow-900/20 border-t border-yellow-800 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-yellow-400 mb-1">Warnings:</p>
              {conversionResult.warnings.map((warn, i) => (
                <p key={i} className="text-xs text-yellow-300">{warn}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}