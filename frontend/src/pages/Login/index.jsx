import styles from './Login.module.css'

const Login = () => {
  return (
    <section className={styles.login}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sign in to continue</h1>
        <p className={styles.subtitle}>
          Access your personalized dashboard and manage inventory securely.
        </p>
      </header>

      <form className={styles.form}>
        <label className={styles.field}>
          <span>Email address</span>
          <input type="email" name="email" placeholder="you@example.com" />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input type="password" name="password" placeholder="••••••••" />
        </label>

        <button type="submit" className={styles.submit}>
          Sign in
        </button>
      </form>
    </section>
  )
}

export default Login
