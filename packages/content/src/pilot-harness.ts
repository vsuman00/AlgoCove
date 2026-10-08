import type { ProblemLanguage } from "@algocove/domain";
/** Trusted portable array-to-integer wrapper; expected values remain on the host. */
export function pilotHarness(
  language: ProblemLanguage,
  source: string,
): {
  file: string;
  source: string;
  compile: readonly (readonly string[])[];
  run: readonly string[];
} {
  switch (language) {
    case "python":
      return {
        file: "/work/fixture.py",
        source: `${source}\nimport sys\n_v=list(map(int,sys.stdin.read().split()))[1:]\n_before=list(_v)\n_result=solve(_v)\nassert _v==_before, 'Input mutation forbidden'\nassert isinstance(_result,int) and not isinstance(_result,bool)\nprint(_result)\n`,
        compile: [["python", "-m", "py_compile", "/work/fixture.py"]],
        run: ["python", "/work/fixture.py"],
      };
    case "javascript":
      return {
        file: "/work/fixture.mjs",
        source: `${source}\nimport fs from 'node:fs';\nconst values=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number).slice(1);\nconst before=values.join(',');\nconst result=solve(values);\nif(values.join(',')!==before || !Number.isSafeInteger(result)) throw Error('Invalid result or mutation');\nconsole.log(result);\n`,
        compile: [["node", "--check", "/work/fixture.mjs"]],
        run: ["node", "/work/fixture.mjs"],
      };
    case "typescript":
      return {
        file: "/work/fixture.ts",
        source: `${source}\ndeclare function require(name: string): {readFileSync(fd: number, encoding: string): string};\nconst values=require('node:fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number).slice(1);\nconst before=values.join(',');\nconst result=solve(values);\nif(values.join(',')!==before || !Number.isSafeInteger(result)) throw Error('Invalid result or mutation');\nconsole.log(result);\n`,
        compile: [
          ["tsc", "--project", "/opt/algocove/tsconfig.typecheck.json"],
          ["tsc", "--project", "/opt/algocove/tsconfig.transpile.json"],
        ],
        run: ["node", "/tmp/algocove-output/fixture.js"],
      };
    case "java":
      return {
        file: "/work/Main.java",
        source: `import java.util.*;\npublic class Main {\n${source}\npublic static void main(String[] args) { Scanner s=new Scanner(System.in); int n=s.nextInt(); int[] values=new int[n]; for(int i=0;i<n;i++) values[i]=s.nextInt(); int[] before=values.clone(); int result=solve(values); if(!Arrays.equals(values,before)) throw new IllegalStateException("Input mutation forbidden"); System.out.println(result); }\n}\n`,
        compile: [
          [
            "javac",
            "-J-Xmx96m",
            "-J-XX:ActiveProcessorCount=1",
            "-d",
            "/tmp/algocove-output",
            "/work/Main.java",
          ],
        ],
        run: [
          "java",
          "-Xmx96m",
          "-XX:ActiveProcessorCount=1",
          "-cp",
          "/tmp/algocove-output",
          "Main",
        ],
      };
    case "cpp":
      return {
        file: "/work/main.cpp",
        source: `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n${source}\nint main() { int n; if(!(cin>>n)||n<0||n>100) return 1; vector<int> values(n); for(int& v:values) if(!(cin>>v)) return 1; const auto before=values; int result=solve(values); if(values!=before) return 1; cout<<result<<'\\n'; }\n`,
        compile: [
          ["g++", "-std=c++23", "-O2", "/work/main.cpp", "-o", "/work/algocove-output/main"],
        ],
        run: ["/work/algocove-output/main"],
      };
    case "c":
      return {
        file: "/work/main.c",
        source: `#include <stdio.h>\n#include <string.h>\n${source}\nint main(void) { int n; if(scanf("%d",&n)!=1||n<0||n>100) return 1; int values[100]={0}, before[100]={0}; for(int i=0;i<n;i++) if(scanf("%d",&values[i])!=1) return 1; memcpy(before,values,sizeof(values)); int result=solve(values,n); if(memcmp(values,before,sizeof(values))) return 1; printf("%d\\n",result); return 0; }\n`,
        compile: [["gcc", "-std=c23", "-O2", "/work/main.c", "-o", "/work/algocove-output/main"]],
        run: ["/work/algocove-output/main"],
      };
  }
}
