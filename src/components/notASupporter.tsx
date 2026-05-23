const PatreonMessage = () => {
  return (
    <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <h1 className="text-2xl mb-2">Support me on Patreon</h1>
      <p className="text-lg leading-relaxed m-0">
        To access the full content, please consider subscribing to me on{' '}
        <a
          href="https://www.patreon.com/BenisBoy16"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#872341] font-bold no-underline hover:underline"
        >
          Patreon
        </a>
        .
      </p>
    </div>
  );
};

export default PatreonMessage;
