type StatusToastProps = {
  message: string;
};

export const StatusToast = (props: StatusToastProps) => {
  return (
    <div className="fixed bottom-5 right-5 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs font-semibold text-slate-50 shadow-lg backdrop-blur">
      {props.message}
    </div>
  );
};
