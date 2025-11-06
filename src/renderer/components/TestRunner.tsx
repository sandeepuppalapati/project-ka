import { useState, useEffect, useRef } from 'react';
import './TestRunner.css';
import { Play, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';

interface TestRunnerProps {
  repos: Array<{ id: string; path: string; name: string }>;
  onClose?: () => void;
}

interface TestResult {
  repo: string;
  command: string;
  status: 'running' | 'passed' | 'failed' | 'idle';
  output: string;
  passed?: number;
  failed?: number;
  total?: number;
  duration?: string;
}

export function TestRunner({ repos, onClose }: TestRunnerProps) {
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const [testCommands, setTestCommands] = useState<Map<string, string>>(new Map());
  const outputRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    // Detect test commands from package.json in each repo
    detectTestCommands();
  }, [repos]);

  const detectTestCommands = async () => {
    const commands = new Map<string, string>();

    for (const repo of repos) {
      try {
        const packageJsonPath = `${repo.path}/package.json`;
        const content = await window.electronAPI.readFile(packageJsonPath);
        if (content) {
          const packageJson = JSON.parse(content);
          const scripts = packageJson.scripts || {};

          // Look for test script
          if (scripts.test) {
            commands.set(repo.id, scripts.test);
          }
        }
      } catch (error) {
        console.error(`Failed to read package.json for ${repo.name}:`, error);
      }
    }

    setTestCommands(commands);

    // Initialize test results
    const results = new Map<string, TestResult>();
    repos.forEach(repo => {
      if (commands.has(repo.id)) {
        results.set(repo.id, {
          repo: repo.name,
          command: commands.get(repo.id)!,
          status: 'idle',
          output: ''
        });
      }
    });
    setTestResults(results);
  };

  const parseTestOutput = (output: string): { passed?: number; failed?: number; total?: number } => {
    // Parse Jest output
    const jestMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/i) ||
                      output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/i);

    if (jestMatch) {
      if (jestMatch.length === 4) {
        return {
          failed: parseInt(jestMatch[1]),
          passed: parseInt(jestMatch[2]),
          total: parseInt(jestMatch[3])
        };
      } else {
        return {
          passed: parseInt(jestMatch[1]),
          failed: 0,
          total: parseInt(jestMatch[2])
        };
      }
    }

    // Parse Mocha output
    const mochaMatch = output.match(/(\d+)\s+passing/i);
    const mochaFailMatch = output.match(/(\d+)\s+failing/i);

    if (mochaMatch) {
      return {
        passed: parseInt(mochaMatch[1]),
        failed: mochaFailMatch ? parseInt(mochaFailMatch[1]) : 0,
        total: parseInt(mochaMatch[1]) + (mochaFailMatch ? parseInt(mochaFailMatch[1]) : 0)
      };
    }

    return {};
  };

  const runTests = async (repoId: string) => {
    const repo = repos.find(r => r.id === repoId);
    const command = testCommands.get(repoId);
    if (!repo || !command) return;

    // Update status to running
    setTestResults(prev => {
      const next = new Map(prev);
      const result = next.get(repoId);
      if (result) {
        next.set(repoId, { ...result, status: 'running', output: '' });
      }
      return next;
    });

    try {
      const startTime = Date.now();

      // Run test command using npm run test
      const result = await window.electronAPI.executeCommand('npm test', repo.path);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      const output = result.stdout + result.stderr;
      const parsed = parseTestOutput(output);
      const status = result.code === 0 ? 'passed' : 'failed';

      setTestResults(prev => {
        const next = new Map(prev);
        const current = next.get(repoId);
        if (current) {
          next.set(repoId, {
            ...current,
            status,
            output,
            ...parsed,
            duration: `${duration}s`
          });
        }
        return next;
      });

      // Scroll to bottom of output
      setTimeout(() => {
        const outputEl = outputRefs.current.get(repoId);
        if (outputEl) {
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      }, 100);
    } catch (error) {
      setTestResults(prev => {
        const next = new Map(prev);
        const current = next.get(repoId);
        if (current) {
          next.set(repoId, {
            ...current,
            status: 'failed',
            output: `Error running tests: ${error}`
          });
        }
        return next;
      });
    }
  };

  const runAllTests = () => {
    repos.forEach(repo => {
      if (testCommands.has(repo.id)) {
        runTests(repo.id);
      }
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <RefreshCw size={16} className="status-icon spinning" />;
      case 'passed':
        return <CheckCircle2 size={16} className="status-icon success" />;
      case 'failed':
        return <XCircle size={16} className="status-icon error" />;
      case 'idle':
        return <Clock size={16} className="status-icon idle" />;
    }
  };

  if (testResults.size === 0) {
    return (
      <div className="test-runner">
        <div className="test-runner-header">
          <span className="test-runner-title">Test Runner</span>
        </div>
        <div className="test-runner-empty">
          <p>No test scripts found in package.json</p>
          <p className="test-runner-hint">Add a "test" script to your package.json to run tests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="test-runner">
      <div className="test-runner-header">
        <span className="test-runner-title">Test Runner</span>
        <button className="run-all-tests-btn" onClick={runAllTests}>
          <Play size={14} />
          Run All Tests
        </button>
      </div>

      <div className="test-runner-content">
        {Array.from(testResults.entries()).map(([repoId, result]) => (
          <div key={repoId} className={`test-result-card ${result.status}`}>
            <div className="test-result-header">
              <div className="test-result-info">
                {getStatusIcon(result.status)}
                <span className="test-result-repo">{result.repo}</span>
                {result.total !== undefined && (
                  <span className="test-result-summary">
                    {result.passed}/{result.total} passed
                    {result.failed ? ` • ${result.failed} failed` : ''}
                  </span>
                )}
                {result.duration && (
                  <span className="test-result-duration">{result.duration}</span>
                )}
              </div>
              <button
                className="run-test-btn"
                onClick={() => runTests(repoId)}
                disabled={result.status === 'running'}
              >
                <Play size={14} />
                {result.status === 'running' ? 'Running...' : 'Run'}
              </button>
            </div>

            {result.output && (
              <div
                ref={el => {
                  if (el) outputRefs.current.set(repoId, el);
                }}
                className="test-result-output"
              >
                <pre>{result.output}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
