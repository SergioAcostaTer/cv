type StatusToastProps = {
  message: string;
};

export const StatusToast = (props: StatusToastProps) => {
  return (
    <div className="fixed bottom-5 right-5 rounded-full border border-border bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
      {props.message}
    </div>
  );
};
