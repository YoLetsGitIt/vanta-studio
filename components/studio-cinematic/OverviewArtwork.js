export function Botanical({ variant = 0 }) {
  return <svg viewBox="0 0 80 100" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    {variant===0 ? <><path d="M39 90c-4-28 9-45 1-66M40 61C17 60 16 42 20 39c14 2 20 10 20 22ZM40 73c22-5 24-24 19-25-12 4-17 13-19 25ZM41 42c14-5 19-16 14-19-10 3-13 9-14 19Z"/><path d="M40 25C22 31 19 16 29 13c-1-13 19-13 20-2 15-1 15 18-1 18Z"/><circle cx="38" cy="19" r="4"/></> : <><path d="M24 91Q48 57 48 16M37 68C13 62 15 44 23 47c9 4 13 11 14 21ZM43 51c22-4 28-20 22-24-14 5-20 13-22 24ZM47 33C28 30 28 12 33 10c11 3 14 12 14 23ZM29 82c14 1 30-7 28-13-12-2-21 5-28 13Z"/></>}
  </svg>;
}

export function Signature() {
  return <svg viewBox="0 0 260 45" fill="none" aria-hidden="true"><path d="M12 34c19-7 28-28 23-29s-17 39-5 34c13-5 22-31 27-29s-12 30-3 25c13-8 17-20 20-14s-8 18 0 14c16-7 21-21 21-15s-8 18 3 14l15-6c-4 12 13 5 20 1s-4 7 4 5c24-9 57-11 84-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}
