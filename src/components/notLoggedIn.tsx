const AccessRestrictedMessage = () => {
  return (
    <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <h1 className="text-2xl mb-2">Access Restricted</h1>
      <p className="text-lg leading-relaxed m-0">
        You need to log in to view this content. Please log in or create an account to continue.
      </p>
    </div>
  );
};

export default AccessRestrictedMessage;
