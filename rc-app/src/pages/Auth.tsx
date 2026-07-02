import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Eye, EyeOff, Mail, ShieldCheck } from "lucide-react";

/* ── FuturePayCA · 一整套登录/注册/找回密码流程 ──────────────────────────────
   两栏卡片:左侧蓝→紫渐变品牌区,右侧白色表单区,外缘发光边框。
   纯前端原型:所有校验/验证码/密码为内存态,完成后进入风控控制台(/dashboard)。
   一个步骤状态机驱动全部界面,step 决定右侧渲染的表单。                          */

type Step =
  | "signup:email"
  | "signup:code"
  | "signup:password"
  | "signup:done"
  | "login:email"
  | "login:password"
  | "login:2fa"
  | "forgot:email"
  | "forgot:sent"
  | "forgot:reset";

const MODE_LABEL: Record<string, string> = { signup: "Sign up", login: "Login", forgot: "Reset password" };
const modeOf = (s: Step) => s.split(":")[0] as "signup" | "login" | "forgot";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// 品牌区随流程切换的欢迎语
const HERO: Record<string, { title: string; sub: string }> = {
  signup: { title: "Welcome!", sub: "创建您的 FuturePayCA 账户,几步即可接入风控控制台。" },
  login: { title: "Welcome back!", sub: "登录以继续处理告警、案件与合规报送。" },
  forgot: { title: "No worries.", sub: "输入注册邮箱,我们会协助您重置密码。" },
};

export default function Auth() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const initial: Step = pathname === "/signup" ? "signup:email" : "login:email";
  const [step, setStep] = useState<Step>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mode = modeOf(step);
  const hero = HERO[mode];

  return (
    <div className="flex min-h-screen w-full bg-[#1b1b1e] p-5 sm:p-8 lg:p-14">
      <div className="m-auto flex w-full max-w-[1600px] flex-col gap-3 sm:gap-4">
        {/* 卡片外·深色底左上角页面标签(与设计稿一致) */}
        <div className="pl-0.5 text-[15px] font-medium text-[#8b8b93]">{MODE_LABEL[mode]}</div>

        {/* 发光渐变边框包裹 */}
        <div
          className="w-full rounded-[26px] p-px"
          style={{
            minHeight: "min(770px, calc(100vh - 150px))",
            background: "linear-gradient(135deg,#3a2fae 0%,#7d43e8 46%,#c86bd6 74%,#ffb2cf 100%)",
            boxShadow: "0 0 60px -18px rgba(150,70,230,.55), 0 0 120px -40px rgba(255,140,205,.4)",
          }}
        >
          <div className="flex min-h-[inherit] overflow-hidden rounded-[25px] bg-white">
            {/* 左:品牌渐变区 — 上三分之一放 Welcome!,底部版权 */}
            <aside className="relative hidden w-[28%] max-w-[470px] shrink-0 flex-col overflow-hidden p-11 text-white lg:flex">
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(158deg,#1a17c4 0%,#341fce 38%,#6b2fe6 72%,#a34ff4 100%)" }}
              />
              {/* 柔光点缀 */}
              <div className="pointer-events-none absolute -left-16 top-[30%] h-72 w-72 rounded-full bg-white/10 blur-3xl" />
              <div
                className="pointer-events-none absolute -bottom-12 -left-8 h-64 w-64 rounded-full"
                style={{ background: "rgba(190,120,255,.5)", filter: "blur(64px)" }}
              />
              <AnimatePresence mode="wait">
                <motion.h1
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="relative font-extrabold leading-none tracking-tight"
                  style={{ marginTop: "clamp(70px,15vh,150px)", fontSize: "clamp(38px,3.4vw,52px)" }}
                >
                  {hero.title}
                </motion.h1>
              </AnimatePresence>
              <div className="absolute bottom-10 left-11 text-[13px] font-medium text-white/70">FuturePay © 2026</div>
            </aside>

            {/* 右:表单区 — 顶部对齐,水平居中 */}
            <section
              className="flex min-w-0 flex-1 items-start justify-center px-6 pb-12 sm:px-10"
              style={{ paddingTop: "clamp(64px,13vh,150px)" }}
            >
              <div className="w-full max-w-[600px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
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
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 步骤路由:根据 step 渲染对应表单 ──────────────────────────────────────────
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
    case "signup:code":
      return <CodeStep {...p} kind="signup" />;
    case "login:2fa":
      return <CodeStep {...p} kind="login" />;
    case "signup:password":
      return <PasswordStep {...p} kind="signup" />;
    case "forgot:reset":
      return <PasswordStep {...p} kind="forgot" />;
    case "login:password":
      return <LoginPassword {...p} />;
    case "forgot:sent":
      return <ForgotSent {...p} />;
    case "signup:done":
      return <SignupDone {...p} />;
    default:
      return null;
  }
}

// ── 复用小组件 ───────────────────────────────────────────────────────────────
function Header({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-9">
      <h2 className="text-[27px] font-extrabold tracking-tight text-[#0b1220]">{title}</h2>
      {sub && <p className="mt-3 text-[15px] text-default-500">{sub}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-[13.5px] font-bold text-[#0b1220]">{children}</label>;
}

// 主按钮:蓝色实心药丸,与设计稿一致
function PrimaryBtn({ children, onPress, isDisabled }: { children: ReactNode; onPress: () => void; isDisabled?: boolean }) {
  return (
    <Button
      onPress={onPress}
      isDisabled={isDisabled}
      radius="full"
      className="h-[56px] w-full text-[16px] font-semibold text-white"
      style={{ background: isDisabled ? "#9db8ee" : "#2f5cf6" }}
    >
      {children}
    </Button>
  );
}

const inputClasses = {
  inputWrapper:
    "h-[56px] rounded-[10px] border border-default-200 bg-white shadow-none data-[hover=true]:border-default-300 group-data-[focus=true]:border-[#2f5cf6] group-data-[focus=true]:border-2",
  input: "text-[15px]",
};

function BackLink({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onPress}
      className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-default-500 transition-colors hover:text-[#2f5cf6]"
    >
      <ArrowLeft className="h-4 w-4" /> {children}
    </button>
  );
}

// ── 步骤 1:输入邮箱(注册 / 登录共用,设计稿主界面)──────────────────────────
function EmailStep({ mode, email, setEmail, go }: ViewProps & { mode: "signup" | "login" }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !emailOk(email);
  const next = () => {
    setTouched(true);
    if (!emailOk(email)) return;
    go(mode === "signup" ? "signup:code" : "login:password");
  };
  return (
    <>
      <Header
        title={mode === "signup" ? "Create your FuturePayCA account" : "Log in to FuturePayCA"}
        sub={
          mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button onClick={() => go("login:email")} className="font-semibold text-[#2f5cf6] hover:underline">
                Log in
              </button>
            </>
          ) : (
            <>
              New to FuturePayCA?{" "}
              <button onClick={() => go("signup:email")} className="font-semibold text-[#2f5cf6] hover:underline">
                Create an account
              </button>
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
        autoFocus
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

// ── 登录:输入密码 ────────────────────────────────────────────────────────────
function LoginPassword({ email, password, setPassword, go }: ViewProps) {
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);
  const submit = () => {
    if (password.length < 6) {
      setErr(true);
      return;
    }
    // 原型:演示两步验证。真实系统在此校验凭据。
    go("login:2fa");
  };
  return (
    <>
      <Header title="Enter your password" sub={<span className="break-all">{email}</span>} />
      <div className="mb-1 flex items-center justify-between">
        <FieldLabel>Password</FieldLabel>
        <button onClick={() => go("forgot:email")} className="mb-2 text-[12.5px] font-semibold text-[#2f5cf6] hover:underline">
          Forgot password?
        </button>
      </div>
      <Input
        type={show ? "text" : "password"}
        value={password}
        onValueChange={(v) => {
          setPassword(v);
          setErr(false);
        }}
        placeholder="Please enter"
        variant="bordered"
        autoFocus
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
      <BackLink onPress={() => go("login:email")}>换个邮箱</BackLink>
      <div className="mt-4 text-[12px] leading-relaxed text-default-400">
        演示账户:任意邮箱 + 任意 6 位以上密码即可登录。
      </div>
    </>
  );
}

// ── 验证码步骤(注册邮箱验证 / 登录两步验证共用)────────────────────────────
function CodeStep({ email, go, done, kind }: ViewProps & { kind: "signup" | "login" }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [secs, setSecs] = useState(30);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  // 登录 2FA 完成 → 进入控制台;注册验证 → 去设置密码
  const onVerify = () => {
    if (code.length !== 6) {
      setErr(true);
      return;
    }
    if (kind === "signup") go("signup:password");
    else done();
  };

  return (
    <>
      <Header
        title={kind === "signup" ? "Verify your email" : "Two-step verification"}
        sub={
          <>
            我们向 <span className="font-semibold text-default-600">{email || "您的邮箱"}</span> 发送了 6 位验证码。
          </>
        }
      />
      <FieldLabel>Verification code</FieldLabel>
      <OTPInput
        value={code}
        onChange={(v) => {
          setCode(v);
          setErr(false);
        }}
        onComplete={onVerify}
        invalid={err}
      />
      {err && <p className="mt-2 text-[12.5px] text-danger">请输入 6 位验证码</p>}
      <div className="mt-3 text-[12.5px] text-default-500">
        没收到?{" "}
        {secs > 0 ? (
          <span className="text-default-400">{secs}s 后可重发</span>
        ) : (
          <button onClick={() => setSecs(30)} className="font-semibold text-[#2f5cf6] hover:underline">
            重新发送
          </button>
        )}
      </div>
      <div className="mt-6">
        <PrimaryBtn onPress={onVerify}>Verify</PrimaryBtn>
      </div>
      <BackLink onPress={() => go(kind === "signup" ? "signup:email" : "login:password")}>返回上一步</BackLink>
    </>
  );
}

// ── 设置密码(注册 / 重置共用)────────────────────────────────────────────────
function PasswordStep({ password, setPassword, go, kind }: ViewProps & { kind: "signup" | "forgot" }) {
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const strength = pwStrength(password);
  const mismatch = touched && confirm.length > 0 && confirm !== password;
  const canSubmit = strength.score >= 2 && confirm === password && password.length >= 8;

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    go(kind === "signup" ? "signup:done" : "login:email");
  };

  return (
    <>
      <Header
        title={kind === "signup" ? "Set a password" : "Create a new password"}
        sub="至少 8 位,建议包含大小写字母与数字。"
      />
      <FieldLabel>Password</FieldLabel>
      <Input
        type={show ? "text" : "password"}
        value={password}
        onValueChange={setPassword}
        placeholder="Please enter"
        variant="bordered"
        autoFocus
        endContent={
          <button onClick={() => setShow((s) => !s)} aria-label={show ? "隐藏密码" : "显示密码"} className="text-default-400 hover:text-default-600">
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        }
        classNames={inputClasses}
      />
      {/* 强度条 */}
      {password.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i < strength.score ? strength.color : "#e9eaee" }}
              />
            ))}
          </div>
          <span className="text-[11.5px] font-semibold" style={{ color: strength.color }}>
            {strength.label}
          </span>
        </div>
      )}
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
        <PrimaryBtn onPress={submit} isDisabled={!canSubmit}>
          {kind === "signup" ? "Create account" : "Reset password"}
        </PrimaryBtn>
      </div>
    </>
  );
}

// ── 找回密码:输入邮箱 ────────────────────────────────────────────────────────
function ForgotEmail({ email, setEmail, go }: ViewProps) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !emailOk(email);
  const submit = () => {
    setTouched(true);
    if (!emailOk(email)) return;
    go("forgot:sent");
  };
  return (
    <>
      <Header title="Reset your password" sub="输入注册邮箱,我们会发送重置链接。" />
      <FieldLabel>Email address</FieldLabel>
      <Input
        type="email"
        value={email}
        onValueChange={setEmail}
        onBlur={() => setTouched(true)}
        placeholder="Please enter"
        variant="bordered"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && submit()}
        isInvalid={invalid}
        errorMessage={invalid ? "请输入有效的邮箱地址" : undefined}
        classNames={inputClasses}
      />
      <div className="mt-6">
        <PrimaryBtn onPress={submit}>Send reset link</PrimaryBtn>
      </div>
      <BackLink onPress={() => go("login:email")}>返回登录</BackLink>
    </>
  );
}

// ── 找回密码:已发送 ──────────────────────────────────────────────────────────
function ForgotSent({ email, go }: ViewProps) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e6efff]">
        <Mail className="h-8 w-8 text-[#2f5cf6]" strokeWidth={1.8} />
      </div>
      <h2 className="text-[24px] font-extrabold tracking-tight text-[#0b1220]">Check your inbox</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-default-500">
        重置链接已发送至 <span className="font-semibold text-default-700">{email}</span>。请在 30 分钟内点击链接完成重置。
      </p>
      <div className="mt-7">
        {/* 原型:直接进入重置密码界面演示后续步骤 */}
        <PrimaryBtn onPress={() => go("forgot:reset")}>我已收到,继续重置</PrimaryBtn>
      </div>
      <BackLink onPress={() => go("login:email")}>返回登录</BackLink>
    </div>
  );
}

// ── 注册完成 ──────────────────────────────────────────────────────────────────
function SignupDone({ email, done }: ViewProps) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f7ed]">
        <Check className="h-9 w-9 text-[#16a34a]" strokeWidth={2.4} />
      </div>
      <h2 className="text-[24px] font-extrabold tracking-tight text-[#0b1220]">You're all set!</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-default-500">
        账户 <span className="font-semibold text-default-700">{email}</span> 已创建。现在即可进入风控控制台。
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-default-50 px-4 py-2.5 text-[12.5px] text-default-500">
        <ShieldCheck className="h-4 w-4 text-[#16a34a]" /> 建议登录后开启两步验证以保护账户
      </div>
      <div className="mt-7">
        <PrimaryBtn onPress={done}>进入控制台</PrimaryBtn>
      </div>
    </div>
  );
}

// ── 6 位验证码输入框 ──────────────────────────────────────────────────────────
function OTPInput({
  value,
  onChange,
  onComplete,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
  invalid?: boolean;
}) {
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
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          maxLength={1}
          aria-label={`验证码第 ${i + 1} 位`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            if (!ch) {
              setAt(i, "");
              return;
            }
            const next = setAt(i, ch);
            if (i < 5) refs.current[i + 1]?.focus();
            if (next.length === 6) onComplete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setAt(i - 1, "");
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!pasted) return;
            onChange(pasted);
            const focusIdx = Math.min(pasted.length, 5);
            refs.current[focusIdx]?.focus();
            if (pasted.length === 6) onComplete();
          }}
          className={`h-[54px] w-full rounded-[10px] border text-center text-[20px] font-bold text-[#0b1220] outline-none transition-colors focus:border-2 focus:border-[#2f5cf6] ${
            invalid ? "border-danger" : "border-default-200"
          }`}
        />
      ))}
    </div>
  );
}

// 简单密码强度评估
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