export interface StackFrame {
  name: string;
  vars: Record<string, any>;
}

export interface HeapObject {
  id: number;
  value: any;
}

export interface TraceStep {
  line: number;
  stack: StackFrame[];
  heap: HeapObject[];
  output: string;
}

export interface ExampleSnippet {
  name: string;
  label: string;
  code: string;
  generate: (input?: any) => TraceStep[];
}

// Line numbers below are 1-indexed and match `BUBBLE_SORT_CODE`.
export const BUBBLE_SORT_CODE = `// Bubble Sort
function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        const temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  return arr;
}
bubbleSort([64, 34, 25, 12, 22, 11, 90]);`;

function heapFor(value: any): HeapObject[] {
  return [{ id: 1, value }];
}

function stackFor(name: string, vars: Record<string, any>): StackFrame[] {
  return [{ name, vars }];
}

/**
 * Generate a step-by-step execution trace for a bubble sort demo.
 * Each step records: the source line being executed, the current stack
 * frame(s) with their local variables, a heap snapshot (the evolving array),
 * and the accumulated console output.
 */
export function generateBubbleSortTrace(
  input: number[] = [64, 34, 25, 12, 22, 11, 90],
): TraceStep[] {
  const arr = [...input];
  const n = arr.length;
  const trace: TraceStep[] = [];
  const output: string[] = [];

  // Function entry.
  trace.push({
    line: 2,
    stack: stackFor('bubbleSort', { arr: [...arr], n }),
    heap: heapFor([...arr]),
    output: '',
  });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      const swapped = arr[j] > arr[j + 1];
      if (swapped) {
        output.push(
          `swap arr[${j}]=${arr[j]} <-> arr[${j + 1}]=${arr[j + 1]}`,
        );
        const temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      } else {
        output.push(
          `no swap (arr[${j}]=${arr[j]}, arr[${j + 1}]=${arr[j + 1]})`,
        );
      }

      trace.push({
        line: 6,
        stack: stackFor('bubbleSort', { arr: [...arr], i, j, temp: swapped ? arr[j + 1] : undefined }),
        heap: heapFor([...arr]),
        output: output.join('\n'),
      });
    }
  }

  // Return statement.
  trace.push({
    line: 13,
    stack: stackFor('bubbleSort', { arr: [...arr] }),
    heap: heapFor([...arr]),
    output: output.join('\n'),
  });

  return trace;
}

// Line numbers match BUBBLE_SORT_CODE above.
// A minimal mock trace for a singly-linked list traversal/reverse is
// provided as an alternative demonstration example.
const LINKED_LIST_CODE = `// Linked List Node + Reverse
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}
function reverse(head) {
  let prev = null;
  let curr = head;
  while (curr !== null) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
const list = new ListNode(1, new ListNode(2, new ListNode(3)));
reverse(list);`;

export function generateLinkedListTrace(): TraceStep[] {
  const steps: TraceStep[] = [
    { line: 12, stack: stackFor('reverse', { prev: null, curr: 'ListNode(1)' }), heap: [{ id: 1, value: '1 -> 2 -> 3' }], output: '' },
    { line: 14, stack: stackFor('reverse', { prev: 'ListNode(1)', curr: 'ListNode(2)' }), heap: [{ id: 1, value: '2 -> 3' }, { id: 2, value: '1' }], output: '' },
    { line: 14, stack: stackFor('reverse', { prev: 'ListNode(2)', curr: 'ListNode(3)' }), heap: [{ id: 1, value: '3' }, { id: 2, value: '2 -> 1' }], output: '' },
    { line: 17, stack: stackFor('reverse', { prev: 'ListNode(3)', curr: null }), heap: [{ id: 1, value: '3 -> 2 -> 1' }], output: '' },
  ];
  return steps;
}

export const EXAMPLES: ExampleSnippet[] = [
  {
    name: 'bubbleSort',
    label: 'Bubble Sort',
    code: BUBBLE_SORT_CODE,
    generate: (input?: any) => generateBubbleSortTrace(input as number[] | undefined),
  },
  {
    name: 'linkedList',
    label: 'Linked List Reverse',
    code: LINKED_LIST_CODE,
    generate: () => generateLinkedListTrace(),
  },
];

export function findExample(name: string): ExampleSnippet | undefined {
  return EXAMPLES.find((e) => e.name === name);
}

export function generateTrace(name: string, input?: any): TraceStep[] {
  return findExample(name)?.generate(input) ?? [];
}

export default {
  EXAMPLES,
  findExample,
  generateTrace,
  generateBubbleSortTrace,
  generateLinkedListTrace,
};
