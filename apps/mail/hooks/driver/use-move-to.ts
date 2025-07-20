import { useDirectActions } from '@/hooks/use-direct-actions';
import type { MoveThreadOptions } from '@/lib/thread-actions';

const useMoveTo = () => {
  const { directMoveThreadsTo } = useDirectActions();

  const mutate = ({ threadIds, currentFolder, destination }: MoveThreadOptions) => {
    directMoveThreadsTo(threadIds, currentFolder, destination);
  };

  return {
    mutate,
    isLoading: false,
  };
};

export default useMoveTo;
