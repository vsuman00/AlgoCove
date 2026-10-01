import type { ProblemLanguage } from "@algocove/domain";

export const correctContainerSource: Record<ProblemLanguage, string> = {
  python:
    "def max_area(heights):\n    left, right, best = 0, len(heights)-1, 0\n    while left < right:\n        best = max(best, (right-left)*min(heights[left], heights[right]))\n        if heights[left] < heights[right]: left += 1\n        else: right -= 1\n    return best\n",
  javascript:
    "function maxArea(h) { let l=0,r=h.length-1,b=0; while(l<r) {b=Math.max(b,(r-l)*Math.min(h[l],h[r])); if(h[l]<h[r]) l++; else r--;} return b; }",
  typescript:
    "function maxArea(h: number[]): number { let l=0,r=h.length-1,b=0; while(l<r) {b=Math.max(b,(r-l)*Math.min(h[l],h[r])); if(h[l]<h[r]) l++; else r--;} return b; }",
  java: "static int maxArea(int[] h) {int l=0,r=h.length-1,b=0; while(l<r) {b=Math.max(b,(r-l)*Math.min(h[l],h[r])); if(h[l]<h[r]) l++; else r--;} return b;}",
  cpp: "int maxArea(const vector<int>& h) {int l=0,r=(int)h.size()-1,b=0; while(l<r) {b=max(b,(r-l)*min(h[l],h[r])); if(h[l]<h[r]) l++; else r--;} return b;}",
  c: "int max_area(const int h[], int n) {int l=0,r=n-1,b=0; while(l<r) {int a=(r-l)*(h[l]<h[r]?h[l]:h[r]); if(a>b)b=a; if(h[l]<h[r])l++;else r--;} return b;}",
};
export const wrongContainerSource: Record<ProblemLanguage, string> = {
  python: "def max_area(heights):\n    return 0",
  javascript: "function maxArea(h) {return 0;}",
  typescript: "function maxArea(h: number[]): number {return 0;}",
  java: "static int maxArea(int[] h) {return 0;}",
  cpp: "int maxArea(const vector<int>& h) {return 0;}",
  c: "int max_area(const int h[], int n) {return 0;}",
};
export const timeoutContainerSource: Record<ProblemLanguage, string> = {
  python: "def max_area(heights):\n    while True: pass",
  javascript: "function maxArea(h) {while(true) {}}",
  typescript: "function maxArea(h: number[]): number {while(true) {}}",
  java: "static int maxArea(int[] h) {while(true) {}}",
  cpp: "int maxArea(const vector<int>& h) {while(true) {}}",
  c: "int max_area(const int h[], int n) {while(1) {}}",
};
export const runtimeErrorContainerSource: Record<ProblemLanguage, string> = {
  python: "def max_area(h):\n    raise RuntimeError('learner failure')",
  javascript: "function maxArea(h) {throw new Error('learner failure');}",
  typescript: "function maxArea(h: number[]): number {throw new Error('learner failure');}",
  java: "static int maxArea(int[] h) {throw new IllegalStateException();}",
  cpp: "int maxArea(const vector<int>& h) {throw 1;}",
  c: "int max_area(const int h[], int n) {abort();}",
};
