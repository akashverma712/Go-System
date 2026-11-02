import { useEffect, useState } from 'react'

const KW = 'package import func return if else for range switch case default select go defer chan map struct interface type var const make new nil true false break continue'.split(' ')
const TOK = /(\/\/.*)|("(?:[^"\\]|\\.)*")|\b([A-Za-z_]\w*)(?=\()|\b([A-Za-z_]\w*)\b|(\d+)/g
function hl(src) {
  const out = []; let last = 0, i = 0, m
  while ((m = TOK.exec(src))) {
    out.push(src.slice(last, m.index)); last = TOK.lastIndex
    const [t, cm, str, fn, word, num] = m
    if (cm) out.push(<span key={i++} className="c">{t}</span>)
    else if (str) out.push(<span key={i++} className="s">{t}</span>)
    else if (fn && !KW.includes(fn)) out.push(<span key={i++} className="f">{t}</span>)
    else if (word && KW.includes(word)) out.push(<span key={i++} className="k">{t}</span>)
    else if (num) out.push(<span key={i++} className="m">{t}</span>)
    else out.push(t)
  }
  out.push(src.slice(last)); return out
}
const Code = ({ cap, children }) => (
  <>{cap && <div className="cap">{cap}</div>}<pre><code>{hl(children.trim())}</code></pre></>
)

const NAV = [
  ['why', 'Why Go, system-design view'], ['goroutines', 'Goroutines'], ['channels', 'Channels'],
  ['waitgroup', 'WaitGroup'], ['mutex', 'Mutex & atomics'], ['deadlock', 'Deadlocks'],
  ['optimize', 'Optimized patterns'], ['cheats', 'Cheat sheet']
]

export default function App() {
  const [active, setActive] = useState('why')
  useEffect(() => {
    const io = new IntersectionObserver(
      es => es.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' })
    NAV.forEach(([id]) => { const el = document.getElementById(id); el && io.observe(el) })
    return () => io.disconnect()
  }, [])

  return (
    <div className="layout">
      <nav>
        <div className="brand">go://field-guide</div>
        {NAV.map(([id, t]) => <a key={id} href={'#' + id} className={active === id ? 'on' : ''}>{t}</a>)}
      </nav>
      <main>
        <div className="hero">
          <h1>Go for modern systems: <span>one binary, a million goroutines</span></h1>
          <p>Hope you guys enjoy this is my second documentation, well switched to building scalable with go recently as the 
            month of GSOC has arrived, and also didnt get a date this Navratri 😭 you can also read my previous documenation and connect me through there:{' '}
            <a href="https://akashverma712.github.io/scaling_systems/">scaling log</a>, which pushed one API to 1.2M req/sec.</p>
          <div className="stats">
            <div className="stat"><b>~2 KB</b><small>initial goroutine stack</small></div>
            <div className="stat"><b>M:N</b><small>goroutines on OS threads</small></div>
            <div className="stat"><b>1 binary</b><small>static, no runtime install</small></div>
            <div className="stat"><b>-race</b><small>built-in data race detector</small></div>
          </div>
        </div>

        <section id="why">
          <h2><span className="n">01</span>Why Go, from a system-design view</h2>
          <p>The scaling log showed the pattern: past a point you stop making one process faster and start making many cheap units of work. Go bakes that into the language, so a single process uses all cores without you managing a thread pool or an event loop by hand.</p>
          <table>
            <thead><tr><th>Design need</th><th>What Go gives you</th><th>Why it matters at scale</th></tr></thead>
            <tbody>
              <tr><td>High concurrency</td><td>Goroutines: 2 KB stacks, growable, user-space scheduled</td><td>100k+ concurrent connections per box is normal; OS threads cost around 1 MB each</td></tr>
              <tr><td>Use every core</td><td>GMP scheduler (Goroutine, Machine, Processor) with work stealing, <code>GOMAXPROCS</code> = cores</td><td>Fixes the "25% CPU, one core busy" problem without PM2-style process forking</td></tr>
              <tr><td>I/O heavy services</td><td>Netpoller (epoll/kqueue): blocking-looking code, non-blocking underneath</td><td>You write simple sequential handlers; no callback hell</td></tr>
              <tr><td>Cheap deploys</td><td>Static binary, tiny container images (often under 20 MB)</td><td>Fast autoscaling and cold starts on Kubernetes or ECS</td></tr>
              <tr><td>Predictable latency</td><td>Concurrent low-pause GC, tunable via <code>GOGC</code> and <code>GOMEMLIMIT</code></td><td>Stable p99 under load</td></tr>
              <tr><td>Operability</td><td><code>pprof</code>, <code>trace</code>, race detector, <code>net/http</code> in stdlib</td><td>Find the real bottleneck, then decide whether to scale up or out</td></tr>
              <tr><td>Backpressure</td><td>Bounded channels, <code>context</code> cancellation and deadlines</td><td>Overload degrades gracefully instead of cascading</td></tr>
            </tbody>
          </table>
          <div className="note"><b>Honest trade-off:</b> Go is not the answer to everything. Hot loops that need SIMD or zero GC (like the Drogon C++ result in the log), heavy ML, or UI work are better elsewhere. Amdahl's law still applies: shared locks and a single DB remain your serial fraction.</div>
        </section>

        <section id="goroutines">
          <h2><span className="n">02</span>Goroutines</h2>
          <p>A goroutine is a function running concurrently, started with <code>go</code>. The runtime multiplexes thousands of them over a few OS threads.</p>
          <Code cap="basic.go">{`
func main() {
    go fmt.Println("runs concurrently")   // fire and forget (risky)
    time.Sleep(time.Second)               // never sync with Sleep in real code
}
`}</Code>
          <div className="warn"><b>Rule 1:</b> when <code>main</code> returns, every goroutine dies. Always wait with a <code>WaitGroup</code>, channel or <code>errgroup</code>.</div>
          <h3>Loop variable capture</h3>
          <p>Since Go 1.22 each loop iteration has its own variable, so this is safe. On older versions, pass it as an argument.</p>
          <Code>{`
for i := 0; i < 3; i++ {
    go func() { fmt.Println(i) }()        // Go 1.22+: prints 0,1,2 in some order
}
for i := 0; i < 3; i++ {
    go func(n int) { fmt.Println(n) }(i)  // safe on every version
}
`}</Code>
          <div className="note"><b>Goroutine leaks:</b> a goroutine blocked forever on a channel is never freed. Give every goroutine an exit path (<code>ctx.Done()</code> or a closed channel).</div>
        </section>

        <section id="channels">
          <h2><span className="n">03</span>Channels</h2>
          <p>Channels move data between goroutines. Share memory by communicating, instead of communicating by sharing memory.</p>
          <Code cap="unbuffered vs buffered">{`
ch := make(chan int)       // unbuffered: send blocks until a receiver is ready
bq := make(chan int, 100)  // buffered: send blocks only when full (backpressure)

go func() { ch <- 42 }()
v := <-ch                  // receive
`}</Code>
          <h3>Producer, close, range</h3>
          <Code>{`
func produce(n int) <-chan int {     // returns receive-only channel
    out := make(chan int)
    go func() {
        defer close(out)             // only the SENDER closes
        for i := 0; i < n; i++ { out <- i }
    }()
    return out
}
for v := range produce(5) { fmt.Println(v) }   // ends when closed
`}</Code>
          <h3>select: timeouts, cancellation, non-blocking</h3>
          <Code>{`
select {
case msg := <-ch:
    handle(msg)
case <-time.After(2 * time.Second):
    return errors.New("timeout")
case <-ctx.Done():
    return ctx.Err()
default:                              // optional: makes it non-blocking
}
`}</Code>
          <table>
            <thead><tr><th>Operation</th><th>nil chan</th><th>closed chan</th></tr></thead>
            <tbody>
              <tr><td>send</td><td>blocks forever</td><td><b>panic</b></td></tr>
              <tr><td>receive</td><td>blocks forever</td><td>returns zero value, <code>ok=false</code></td></tr>
              <tr><td>close</td><td><b>panic</b></td><td><b>panic</b></td></tr>
            </tbody>
          </table>
        </section>

        <section id="waitgroup">
          <h2><span className="n">04</span>sync.WaitGroup</h2>
          <p>A counter that lets one goroutine wait for many others to finish.</p>
          <Code cap="classic form">{`
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)                 // BEFORE starting the goroutine
    go func() {
        defer wg.Done()       // always via defer
        fetch(url)
    }()
}
wg.Wait()
`}</Code>
          <Code cap="Go 1.25+: wg.Go does Add + Done for you">{`
var wg sync.WaitGroup
for _, url := range urls {
    wg.Go(func() { fetch(url) })
}
wg.Wait()
`}</Code>
          <div className="warn"><b>Bugs to avoid:</b> calling <code>Add</code> inside the goroutine (race with <code>Wait</code>), copying a WaitGroup by value (pass a pointer), and calling <code>Done</code> more times than <code>Add</code> (panic).</div>
        </section>

        <section id="mutex">
          <h2><span className="n">05</span>Mutex, RWMutex and atomics</h2>
          <Code cap="protect shared state">{`
type Counter struct {
    mu sync.Mutex
    n  map[string]int
}
func (c *Counter) Inc(k string) {
    c.mu.Lock()
    defer c.mu.Unlock()       // unlock on every path, including panics
    c.n[k]++
}
`}</Code>
          <h3>Pick the lightest tool</h3>
          <table>
            <thead><tr><th>Tool</th><th>Use when</th></tr></thead>
            <tbody>
              <tr><td><code>sync.Mutex</code></td><td>Default for shared state with mixed reads and writes</td></tr>
              <tr><td><code>sync.RWMutex</code></td><td>Read-heavy (roughly 90%+ reads) and critical section is not tiny</td></tr>
              <tr><td><code>sync/atomic</code></td><td>Single counters or flags: <code>atomic.Int64</code>, <code>atomic.Bool</code>, <code>atomic.Pointer[T]</code></td></tr>
              <tr><td><code>sync.Once</code> / <code>OnceValue</code></td><td>Lazy one-time init, safe across goroutines</td></tr>
              <tr><td><code>sync.Map</code></td><td>Write-once-read-many or disjoint keys; otherwise a map plus a mutex is faster</td></tr>
              <tr><td>Sharding</td><td>One hot lock limits you (Amdahl). Split into N shards by <code>hash(key) % N</code></td></tr>
            </tbody>
          </table>
          <Code cap="lock-free counter">{`
var hits atomic.Int64
hits.Add(1)
fmt.Println(hits.Load())
`}</Code>
          <div className="note">Run <code>go test -race ./...</code> in CI. It catches data races that are nearly impossible to spot by reading.</div>
        </section>

        <section id="deadlock">
          <h2><span className="n">06</span>Deadlocks</h2>
          <p>All goroutines are blocked and none can make progress. Go detects the "all asleep" case and crashes with <code>fatal error: all goroutines are asleep - deadlock!</code>. Partial deadlocks (a few stuck goroutines) are silent, which is worse.</p>
          <h3>Four classic causes, with fixes</h3>
          <Code cap="1. unbuffered send with no receiver">{`
ch := make(chan int)
ch <- 1                       // DEADLOCK: nobody receives
// fix: receive in another goroutine, or use make(chan int, 1)
`}</Code>
          <Code cap="2. lock ordering (A->B vs B->A)">{`
// goroutine 1: lock(a); lock(b)      goroutine 2: lock(b); lock(a)
// fix: ALWAYS acquire locks in one global order, e.g. by ID
`}</Code>
          <Code cap="3. re-locking a non-reentrant Mutex">{`
func (c *C) A() { c.mu.Lock(); defer c.mu.Unlock(); c.B() }
func (c *C) B() { c.mu.Lock(); defer c.mu.Unlock() }   // DEADLOCK
// fix: split into locked helper  b()  that assumes the lock is held
`}</Code>
          <Code cap="4. WaitGroup.Wait while workers block on a full channel">{`
// workers send results to an unread channel, Wait never returns
// fix: collect results in another goroutine, or close(results) after Wait:
go func() { wg.Wait(); close(results) }()
for r := range results { use(r) }
`}</Code>
          <div className="note"><b>Debugging:</b> send <code>SIGQUIT</code> to dump every goroutine stack, or expose <code>net/http/pprof</code> and open <code>/debug/pprof/goroutine?debug=2</code>.</div>
        </section>

        <section id="optimize">
          <h2><span className="n">07</span>Optimized, production patterns</h2>
          <h3>Bounded worker pool (never spawn unbounded goroutines)</h3>
          <Code>{`
func process(ctx context.Context, jobs []Job, workers int) []Result {
    in  := make(chan Job)
    out := make(chan Result, len(jobs))
    var wg sync.WaitGroup
    for range workers {                      // Go 1.22: range over int
        wg.Go(func() {
            for j := range in {
                select {
                case out <- run(j):
                case <-ctx.Done():
                    return
                }
            }
        })
    }
    for _, j := range jobs { in <- j }
    close(in)
    wg.Wait(); close(out)
    res := make([]Result, 0, len(jobs))      // preallocate capacity
    for r := range out { res = append(res, r) }
    return res
}
`}</Code>
          <h3>errgroup: first error cancels everyone</h3>
          <Code>{`
g, ctx := errgroup.WithContext(ctx)   // golang.org/x/sync/errgroup
g.SetLimit(16)                        // built-in concurrency cap
for _, id := range ids {
    g.Go(func() error { return fetchUser(ctx, id) })
}
if err := g.Wait(); err != nil { return err }
`}</Code>
          <h3>Context deadlines on every outbound call</h3>
          <Code>{`
ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
defer cancel()
req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
`}</Code>
          <h3>Cut allocations and GC pressure</h3>
          <Code>{`
var bufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}

buf := bufPool.Get().(*bytes.Buffer)
buf.Reset()
defer bufPool.Put(buf)

m := make(map[string]int, 10_000)    // size hints avoid rehashing
var sb strings.Builder; sb.Grow(256) // not s += x in loops
`}</Code>
          <h3>Graceful shutdown</h3>
          <Code>{`
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
go srv.ListenAndServe()
<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)             // drains in-flight requests
`}</Code>
          <div className="note"><b>Measure first:</b> <code>go test -bench . -benchmem</code>, then <code>pprof</code> (CPU, heap, mutex, block profiles). Tune <code>GOMEMLIMIT</code> in containers; use <code>go.uber.org/automaxprocs</code> on older Go so <code>GOMAXPROCS</code> respects cgroup CPU limits (Go 1.25 does this natively).</div>
        </section>

        <section id="cheats">
          <h2><span className="n">08</span>Cheat sheet</h2>
          <table>
            <thead><tr><th>Rule</th><th>Why</th></tr></thead>
            <tbody>
              <tr><td>Every goroutine has an owner and an exit</td><td>Prevents leaks</td></tr>
              <tr><td>Sender closes channels, never the receiver</td><td>Avoids send-on-closed panic</td></tr>
              <tr><td><code>defer Unlock()</code> and <code>defer wg.Done()</code></td><td>Correct on early return and panic</td></tr>
              <tr><td>Bound concurrency (pool, <code>SetLimit</code>, semaphore channel)</td><td>Protects DB, memory and downstreams</td></tr>
              <tr><td>Pass <code>context.Context</code> as first argument</td><td>Cancellation and deadlines propagate</td></tr>
              <tr><td>Prefer channels for flow, mutex for state</td><td>Use the simplest correct tool</td></tr>
              <tr><td>CI: <code>go vet</code>, <code>-race</code>, benchmarks</td><td>Catch bugs and regressions early</td></tr>
            </tbody>
          </table>
        </section>

        {/* <section id="deploy">
          <h2><span className="n">09</span>Deploy this site on GitHub Pages</h2>
          <p>The repo already contains <code>.github/workflows/deploy.yml</code>, so you only push.</p>
          <Code cap="terminal">{`
git init
git add .
git commit -m "go docs"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
`}</Code>
          <p>Then on GitHub: <b>Settings → Pages → Source: GitHub Actions</b>. Watch the <b>Actions</b> tab; when green, the site is at <code>https://&lt;username&gt;.github.io/&lt;repo&gt;/</code>. Every push to <code>main</code> redeploys.</p>
        </section> */}
        <footer>Built with React + Vite. Reference design: <a href="https://akashverma712.github.io/scaling_systems/">scaling_systems</a>.</footer>
      </main>
    </div>
  )
}
