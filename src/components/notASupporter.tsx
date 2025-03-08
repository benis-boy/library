const PatreonMessage = () => {
  return (
    <div className="message-container p-5 font-sans ">
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
