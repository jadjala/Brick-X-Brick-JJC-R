import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { HardHat, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { Button, Input, Field } from '@/components/brutalist';

const schema = z.object({
  email: z.string().min(1, 'Required').email('Enter a valid email'),
  password: z.string().min(1, 'Required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  // Already signed in → skip the form.
  useEffect(() => {
    if (session) navigate('/attendance', { replace: true });
  }, [session, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await signIn(values.email, values.password);
      navigate('/attendance', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[1.1fr_1fr]">
      {/* Signage panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 md:flex">
        <div className="hazard-tape h-4 w-full border-2 border-paper" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-orange">Brick × Brick</p>
          <h1 className="mt-3 font-display text-6xl font-bold uppercase leading-[0.95] tracking-tight text-paper">
            Attendance
            <br />
            Control
          </h1>
          <p className="mt-6 max-w-sm font-mono text-sm leading-relaxed text-concrete">
            Site attendance & audit system. JJC-R Blueprints and Drafting Services.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HardHat className="h-6 w-6 text-yellow" strokeWidth={2} />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-paper">
            Authorized Personnel Only
          </span>
        </div>
        <div className="hazard-tape h-4 w-full border-2 border-paper" />
      </section>

      {/* Form panel */}
      <section className="flex flex-col justify-center bg-paper px-6 py-12 md:px-14">
        <div className="mx-auto w-full max-w-sm">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-orange md:hidden">Brick × Brick</p>
          <h2 className="mb-1 font-display text-3xl font-bold uppercase tracking-tight text-ink">Sign In</h2>
          <p className="mb-8 font-mono text-xs uppercase tracking-widest text-steel">Credentials required</p>

          {serverError && (
            <div className="mb-6 flex items-stretch border-2 border-ink bg-absent text-paper shadow-hard">
              <div className="flex items-center gap-2 border-r-2 border-paper/40 px-3 py-2">
                <TriangleAlert className="h-4 w-4" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Denied</span>
              </div>
              <p className="flex items-center px-3 py-2 font-mono text-sm">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" placeholder="you@bxb.test" {...register('email')} />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} />
            </Field>
            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? '[ Authenticating... ]' : 'Sign In →'}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
