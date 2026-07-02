import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Eye, EyeOff, Mail } from "lucide-react";
import logoIcon from "@/assets/logo-icon.svg";

/* ── FuturePayCA · 注册/登录/找回密码 —— 按设计稿还原 ─────────────────────────
   注册为 4 步引导:左侧竖向步骤条(Your details → Verify email → Invite team →
   Welcome),右侧居中表单(logo + 标题 + 输入 + Next + 轮播点),底部页脚。
   登录 / 找回复用同一外壳,左侧改为品牌欢迎语(无步骤条)。纯前端原型。       */

const BLUE = "#2f6bed"; // 设计稿主蓝(按钮 / 链接 / 高亮)

type Step =
  | "signup:email"
  | "signup:password"
  | "signup:verify"
  | "signup:invite"
  | "signup:done"
  | "login:email"
  | "login:password"
  | "login:2fa"
  | "forgot:email"
  | "forgot:sent"
  | "forgot:reset";

const modeOf = (s: Step) => s.split(":")[0] as "signup" | "login" | "forgot";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// 左侧步骤条(仅注册)
const STEPS = [
  { t: "Your details", d: "Provide an email and password" },
  { t: "Verify your email", d: "Enter your verification code" },
  { t: "Invite your team", d: "Start collaborating with your team" },
  { t: "Welcome to FuturePayCA!", d: "Get up and running in 60 seconds" },
];
// 各注册子步骤对应的步骤条索引(Your details 覆盖 邮箱 + 密码两屏)
const STEP_IDX: Partial<Record<Step, number>> = {
  "signup:email": 0,
  "signup:password": 0,
  "signup:verify": 1,
  "signup:invite": 2,
  "signup:done": 3,
};

// 登录 / 找回的左侧欢迎语
const BRAND: Record<string, { title: string; sub: string }> = {
  login: { title: "Welcome back!", sub: "登录以继续处理今日的告警、案件与合规报送。" },
  forgot: { title: "No worries.", sub: "输入注册邮箱,我们会协助您安全地重置密码。" },
};

export default function Auth() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const initial: Step = pathname === "/login" ? "login:email" : "signup:email";
  const [step, setStep] = useState<Step>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mode = modeOf(step);
  const idx = STEP_IDX[step] ?? 0;

  return (
    <div className="min-h-screen w-full bg-white p-2.5 sm:p-3">
      {/* 整屏渐变卡 + 亮紫描边 */}
      <div
        className="relative flex overflow-hidden rounded-[26px]"
        style={{
          minHeight: "calc(100vh - 24px)",
          background: "linear-gradient(150deg,#201cd0 0%,#3a1fd6 34%,#6a30e6 68%,#9b40f2 100%)",
          boxShadow: "inset 0 0 0 2px rgba(184,116,250,.85), 0 0 44px -12px rgba(150,80,240,.5)",
        }}
      >
        {/* ── 左:渐变品牌区 ── */}
        <aside className="relative hidden w-[36%] max-w-[560px] shrink-0 flex-col overflow-hidden px-11 py-10 text-white lg:flex">
          {/* 大 F 水印 */}
          <img
            src={logoIcon}
            aria-hidden
            className="pointer-events-none absolute right-[-60px] top-1/2 w-[440px] -translate-y-1/2 select-none opacity-[0.07]"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          {/* logo */}
          <div className="relative flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="text-[19px] font-extrabold tracking-tight">FuturePayCA</span>
          </div>

          {mode === "signup" ? (
            <Stepper idx={idx} />
          ) : (
            <div className="relative mt-auto mb-auto max-w-[340px]">
              <h1 className="text-[46px] font-extrabold leading-[1.05] tracking-tight">{BRAND[mode].title}</h1>
              <p className="mt-5 text-[15px] leading-relaxed text-white/75">{BRAND[mode].sub}</p>
            </div>
          )}
        </aside>

        {/* ── 右:白色表单面板(内缩留出渐变边) ── */}
        <main className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex h-full flex-col rounded-[18px] bg-white">
            <div className="flex flex-1 items-center justify-center px-6 py-10">
              <div className="w-full max-w-[440px]">
                {/* 顶部居中 logo */}
                <img src={logoIcon} alt="FuturePayCA" className="mx-auto mb-7 h-9 w-auto" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                  >
                    <StepView
                      step={step}
                      go={setStep}
                      done={() => nav("/dashboard")}
                      email={email}
                      setEmail={setEmail}
                      password={password}
                      setPassword={setPassword}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* 轮播点(仅注册,反映当前步骤) */}
                {mode === "signup" && (
                  <div className="mt-9 flex items-center justify-center gap-2">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className="h-2 rounded-full transition-all"
                        style={{ width: i === idx ? 26 : 8, background: i === idx ? BLUE : "#d4d7dd" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 页脚 */}
            <div className="flex items-center justify-between px-8 py-5 text-[13px] text-default-500">
              <span>© 2026 FuturePay</span>
              <span className="flex gap-6">
                <button className="transition-colors hover:text-default-700">Privacy Policy</button>
                <button className="transition-colors hover:text-default-700">Support</button>
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── 左侧竖向步骤条 ────────────────────────────────────────────────────────────
function Stepper({ idx }: { idx: number }) {
  return (
    <div className="relative mt-16 flex flex-col">
      {STEPS.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tnum"
                style={
                  done
                    ? { background: "#fff", color: "#3a1fd6" }
                    : active
                      ? { border: "2px solid #fff", color: "#fff" }
                      : { border: "1.5px solid rgba(255,255,255,.4)", color: "rgba(255,255,255,.55)" }
                }
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className="my-1.5 min-h-[26px] w-px flex-1 border-l border-dashed border-white/30" />
              )}
            </div>
            <div className="pb-8">
              <div className={`text-[16px] font-bold leading-tight ${active ? "text-white" : "text-white/55"}`}>{s.t}</div>
              <div className={`mt-1 text-[13.5px] leading-snug ${active ? "text-white/75" : "text-white/40"}`}>{s.d}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 步骤路由 ──────────────────────────────────────────────────────────────────
type ViewProps = {
  step: Step;
  go: (s: Step) => void;
  done: () => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
};

function StepView(p: ViewProps) {
  switch (p.step) {
    case "signup:email":
      return <EmailStep {...p} mode="signup" />;
    case "login:email":
      return <EmailStep {...p} mode="login" />;
    case "forgot:email":
      return <ForgotEmail {...p} />;
    case "signup:password":
      return <SignupPassword {...p} />;
    case "signup:verify":
      return <CodeStep {...p} kind="signup" />;
    case "login:2fa":
      return <CodeStep {...p} kind="login" />;
    case "signup:invite":
      return <InviteStep {...p} />;
    case "signup:done":
      return <SignupDone {...p} />;
    case "forgot:reset":
      return <ResetPassword {...p} />;
    case "login:password":
      return <LoginPassword {...p} />;
    case "forgot:sent":
      return <ForgotSent {...p} />;
    default:
      return null;
  }
}

// ── 复用小组件 ───────────────────────────────────────────────────────────────
function Head({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="text-[26px] font-bold tracking-tight text-[#0b1220]">{title}</h2>
      {sub && <p className="mt-2 text-[14.5px] text-default-500">{sub}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-[14px] font-bold text-[#0b1220]">{children}</label>;
}

function PrimaryBtn({ children, onPress, isDisabled }: { children: ReactNode; onPress: () => void; isDisabled?: boolean }) {
  return (
    <Button
      onPress={onPress}
      isDisabled={isDisabled}
      radius="full"
      className="h-[54px] w-full text-[15.5px] font-semibold text-white"
      style={{ background: isDisabled ? "#a9c1f4" : BLUE }}
    >
      {children}
    </Button>
  );
}

const inputClasses = {
  inputWrapper:
    "h-[54px] rounded-[10px] border border-default-200 bg-white shadow-none data-[hover=true]:border-default-300 group-data-[focus=true]:border-2 group-data-[focus=true]:border-[#2f6bed]",
  input: "text-[15px]",
};

function GhostLink({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <button onClick={onPress} className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-default-500 transition-colors hover:text-[#2f6bed]">
      <ArrowLeft className="h-4 w-4" /> {children}
    </button>
  );
}

// ── 注册/登录 · 输入邮箱 ──────────────────────────────────────────────────────
function EmailStep({ mode, email, setEmail, go }: ViewProps & { mode: "signup" | "login" }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !emailOk(email);
  const next = () => {
    setTouched(true);
    if (!emailOk(email)) return;
    go(mode === "signup" ? "signup:password" : "login:password");
  };
  return (
    <>
      <Head
        title={mode === "signup" ? "Create your account" : "Log in to your account"}
        sub={
          mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button onClick={() => go("login:email")} className="font-semibold hover:underline" style={{ color: BLUE }}>Log in</button>
            </>
          ) : (
            <>
              New to FuturePayCA?{" "}
              <button onClick={() => go("signup:email")} className="font-semibold hover:underline" style={{ color: BLUE }}>Create an account</button>
            </>
          )
        }
      />
      <FieldLabel>First, enter your email address</FieldLabel>
      <Input
        type="email"
        value={email}
        onValueChange={setEmail}
        onBlur={() => setTouched(true)}
        placeholder="Please enter"
        variant="bordered"
        onKeyDown={(e) => e.key === "Enter" && next()}
        isInvalid={invalid}
        errorMessage={invalid ? "请输入有效的邮箱地址" : undefined}
        classNames={inputClasses}
      />
      <div className="mt-6">
        <PrimaryBtn onPress={next}>Next</PrimaryBtn>
      </div>
    </>
  );
}

// ── 注册 · 设置密码 ───────────────────────────────────────────────────────────
function SignupPassword({ email, password, setPassword, go }: ViewProps) {
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const st = pwStrength(password);
  const canSubmit = st.score >= 2 && password.length >= 8;
  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    go("signup:verify");
  };
  return (
    <>
      <Head title="Create your account" sub={<span className="break-all">{email}</span>} />
      <FieldLabel>Now, create a password</FieldLabel>
      <Input
        type={show ? "text" : "password"}
        value={password}
        onValueChange={setPassword}
        placeholder="Please enter"
        variant="bordered"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        isInvalid={touched && !canSubmit}
        errorMessage={touched && !canSubmit ? "密码至少 8 位,建议含大小写字母与数字" : undefined}
        endContent={
          <button onClick={() => setShow((s) => !s)} aria-label={show ? "隐藏密码" : "显示密码"} className="text-default-400 hover:text-default-600">
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        }
        classNames={inputClasses}
      />
      {password.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < st.score ? st.color : "#e9eaee" }} />
            ))}
          </div>
          <span className="text-[11.5px] font-semibold" style={{ color: st.color }}>{st.label}</span>
        </div>
      )}
      <div className="mt-6">
        <PrimaryBtn onPress={submit} isDisabled={!canSubmit}>Next</PrimaryBtn>
      </div>
      <GhostLink onPress={() => go("signup:email")}>返回上一步</GhostLink>
    </>
  );
}

// ── 验证码(注册验证 / 登录 2FA) ────────────────────────────────────────────
function CodeStep({ email, go, done, kind }: ViewProps & { kind: "signup" | "login" }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [secs, setSecs] = useState(30);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  const onVerify = () => {
    if (code.length !== 6) { setErr(true); return; }
    if (kind === "signup") go("signup:invite");
    else done();
  };
  return (
    <>
      <Head
        title={kind === "signup" ? "Verify your email" : "Two-step verification"}
        sub={<>我们向 <span className="font-semibold text-default-700">{email || "您的邮箱"}</span> 发送了 6 位验证码。</>}
      />
      <FieldLabel>Verification code</FieldLabel>
      <OTPInput value={code} onChange={(v) => { setCode(v); setErr(false); }} onComplete={onVerify} invalid={err} />
      {err && <p className="mt-2 text-[12.5px] text-danger">请输入 6 位验证码</p>}
      <div className="mt-3 text-center text-[12.5px] text-default-500">
        没收到?{" "}
        {secs > 0 ? <span className="text-default-400">{secs}s 后可重发</span> : <button onClick={() => setSecs(30)} className="font-semibold hover:underline" style={{ color: BLUE }}>重新发送</button>}
      </div>
      <div className="mt-6">
        <PrimaryBtn onPress={onVerify}>Verify</PrimaryBtn>
      </div>
      <div className="text-center">
        <GhostLink onPress={() => go(kind === "signup" ? "signup:password" : "login:password")}>返回上一步</GhostLink>
      </div>
    </>
  );
}

// ── 注册 · 邀请团队 ───────────────────────────────────────────────────────────
function InviteStep({ go }: ViewProps) {
  const [rows, setRows] = useState(["", ""]);
  return (
    <>
      <Head title="Invite your team" sub="加同事一起用,或先跳过。" />
      <FieldLabel>Teammate emails</FieldLabel>
      <div className="flex flex-col gap-2.5">
        {rows.map((v, i) => (
          <Input
            key={i}
            type="email"
            value={v}
            onValueChange={(nv) => setRows((r) => r.map((x, j) => (j === i ? nv : x)))}
            placeholder="colleague@company.com"
            variant="bordered"
            classNames={inputClasses}
          />
        ))}
      </div>
      <button onClick={() => setRows((r) => [...r, ""])} className="mt-3 text-[13px] font-semibold hover:underline" style={{ color: BLUE }}>+ 添加一位</button>
      <div className="mt-6">
        <PrimaryBtn onPress={() => go("signup:done")}>Send invites</PrimaryBtn>
      </div>
      <div className="mt-3 text-center">
        <button onClick={() => go("signup:done")} className="text-[13.5px] font-semibold text-default-500 hover:text-default-700">Skip for now</button>
      </div>
    </>
  );
}

// ── 注册完成 ──────────────────────────────────────────────────────────────────
function SignupDone({ done }: ViewProps) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f7ed]">
        <Check className="h-9 w-9 text-[#16a34a]" strokeWidth={2.4} />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight text-[#0b1220]">Welcome to FuturePayCA!</h2>
      <p className="mx-auto mt-2 max-w-[320px] text-[14.5px] text-default-500">账户已就绪 —— 60 秒内即可进入风控控制台。</p>
      <div className="mt-7">
        <PrimaryBtn onPress={done}>Enter console</PrimaryBtn>
      </div>
    </div>
  );
}

// ── 登录 · 密码 ───────────────────────────────────────────────────────────────
function LoginPassword({ email, password, setPassword, go }: ViewProps) {
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);
  const submit = () => {
    if (password.length < 6) { setErr(true); return; }
    go("login:2fa");
  };
  return (
    <>
      <Head title="Enter your password" sub={<span className="break-all">{email}</span>} />
      <div className="mb-1 flex items-center justify-between">
        <FieldLabel>Password</FieldLabel>
        <button onClick={() => go("forgot:email")} className="mb-2 text-[12.5px] font-semibold hover:underline" style={{ color: BLUE }}>Forgot password?</button>
      </div>
      <Input
        type={show ? "text" : "password"}
        value={password}
        onValueChange={(v) => { setPassword(v); setErr(false); }}
        placeholder="Please enter"
        variant="bordered"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        isInvalid={err}
        errorMessage={err ? "密码至少 6 位" : undefined}
        endContent={
          <button onClick={() => setShow((s) => !s)} aria-label={show ? "隐藏密码" : "显示密码"} className="text-default-400 hover:text-default-600">
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        }
        classNames={inputClasses}
      />
      <div className="mt-6">
        <PrimaryBtn onPress={submit}>Log in</PrimaryBtn>
      </div>
      <div className="text-center">
        <GhostLink onPress={() => go("login:email")}>换个邮箱</GhostLink>
      </div>
    </>
  );
}

// ── 找回 · 输入邮箱 ───────────────────────────────────────────────────────────
function ForgotEmail({ email, setEmail, go }: ViewProps) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !emailOk(email);
  const submit = () => { setTouched(true); if (!emailOk(email)) return; go("forgot:sent"); };
  return (
    <>
      <Head title="Reset your password" sub="输入注册邮箱,我们会发送重置链接。" />
      <FieldLabel>Email address</FieldLabel>
      <Input
        type="email"
        value={email}
        onValueChange={setEmail}
        onBlur={() => setTouched(true)}
        placeholder="Please enter"
        variant="bordered"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        isInvalid={invalid}
        errorMessage={invalid ? "请输入有效的邮箱地址" : undefined}
        classNames={inputClasses}
      />
      <div className="mt-6">
        <PrimaryBtn onPress={submit}>Send reset link</PrimaryBtn>
      </div>
      <div className="text-center">
        <GhostLink onPress={() => go("login:email")}>返回登录</GhostLink>
      </div>
    </>
  );
}

// ── 找回 · 已发送 ─────────────────────────────────────────────────────────────
function ForgotSent({ email, go }: ViewProps) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#e9f0ff" }}>
        <Mail className="h-8 w-8" strokeWidth={1.8} style={{ color: BLUE }} />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight text-[#0b1220]">Check your inbox</h2>
      <p className="mx-auto mt-2 max-w-[340px] text-[14.5px] text-default-500">重置链接已发送至 <span className="font-semibold text-default-700">{email}</span>,30 分钟内有效。</p>
      <div className="mt-7">
        <PrimaryBtn onPress={() => go("forgot:reset")}>我已收到,继续重置</PrimaryBtn>
      </div>
      <div className="text-center">
        <GhostLink onPress={() => go("login:email")}>返回登录</GhostLink>
      </div>
    </div>
  );
}

// ── 找回 · 设新密码 ───────────────────────────────────────────────────────────
function ResetPassword({ password, setPassword, go }: ViewProps) {
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const st = pwStrength(password);
  const mismatch = touched && confirm.length > 0 && confirm !== password;
  const canSubmit = st.score >= 2 && password.length >= 8 && confirm === password;
  const submit = () => { setTouched(true); if (!canSubmit) return; go("login:email"); };
  return (
    <>
      <Head title="Create a new password" sub="至少 8 位,建议含大小写字母与数字。" />
      <FieldLabel>New password</FieldLabel>
      <Input
        type={show ? "text" : "password"}
        value={password}
        onValueChange={setPassword}
        placeholder="Please enter"
        variant="bordered"
        endContent={
          <button onClick={() => setShow((s) => !s)} aria-label={show ? "隐藏密码" : "显示密码"} className="text-default-400 hover:text-default-600">
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        }
        classNames={inputClasses}
      />
      <div className="mt-4">
        <FieldLabel>Confirm password</FieldLabel>
        <Input
          type={show ? "text" : "password"}
          value={confirm}
          onValueChange={setConfirm}
          onBlur={() => setTouched(true)}
          placeholder="Please enter"
          variant="bordered"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          isInvalid={mismatch}
          errorMessage={mismatch ? "两次输入的密码不一致" : undefined}
          classNames={inputClasses}
        />
      </div>
      <div className="mt-6">
        <PrimaryBtn onPress={submit} isDisabled={!canSubmit}>Reset password</PrimaryBtn>
      </div>
    </>
  );
}

// ── 6 位验证码输入 ────────────────────────────────────────────────────────────
function OTPInput({ value, onChange, onComplete, invalid }: { value: string; onChange: (v: string) => void; onComplete: () => void; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = useMemo(() => Array.from({ length: 6 }, (_, i) => value[i] ?? ""), [value]);
  const setAt = (i: number, ch: string) => {
    const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    return next;
  };
  return (
    <div className="flex gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          inputMode="numeric"
          maxLength={1}
          aria-label={`验证码第 ${i + 1} 位`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            if (!ch) { setAt(i, ""); return; }
            const next = setAt(i, ch);
            if (i < 5) refs.current[i + 1]?.focus();
            if (next.length === 6) onComplete();
          }}
          onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) { refs.current[i - 1]?.focus(); setAt(i - 1, ""); } }}
          onPaste={(e) => {
            e.preventDefault();
            const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!p) return;
            onChange(p);
            refs.current[Math.min(p.length, 5)]?.focus();
            if (p.length === 6) onComplete();
          }}
          className={`tnum h-[54px] w-full rounded-[10px] border text-center text-[20px] font-bold text-[#0b1220] outline-none transition-colors focus:border-2 ${invalid ? "border-danger" : "border-default-200 focus:border-[#2f6bed]"}`}
        />
      ))}
    </div>
  );
}

function pwStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(score, 4);
  const map = [
    { label: "太弱", color: "#dc2626" },
    { label: "较弱", color: "#dc2626" },
    { label: "一般", color: "#c2710c" },
    { label: "较强", color: "#16a34a" },
    { label: "很强", color: "#16a34a" },
  ];
  return { score, ...map[score] };
}
