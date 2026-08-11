import type {
  NotificationSubjectEnrichmentResult,
  NotificationSubjectEnrichmentTarget,
} from '../../shared/types/notifications';

type BatchHandler = (
  targets: NotificationSubjectEnrichmentTarget[],
  requestIndex: number
) => NotificationSubjectEnrichmentResult[] | Promise<NotificationSubjectEnrichmentResult[]>;

interface DeferredBatch {
  targets: NotificationSubjectEnrichmentTarget[];
  resolve: (results: NotificationSubjectEnrichmentResult[]) => void;
  reject: (error: Error) => void;
}

export class InMemoryNotificationSubjectEnrichmentAdapter {
  readonly pending: DeferredBatch[] = [];
  private requestCount = 0;

  constructor(
    private readonly handler?: BatchHandler,
    private readonly maxBatchSize = 50
  ) {}

  load = async (targets: NotificationSubjectEnrichmentTarget[]) => {
    if (targets.length > this.maxBatchSize) {
      throw new Error(`Batch exceeds ${this.maxBatchSize} targets`);
    }

    const requestIndex = this.requestCount++;
    if (this.handler) {
      return this.handler(targets, requestIndex);
    }

    return new Promise<NotificationSubjectEnrichmentResult[]>((resolve, reject) => {
      this.pending.push({ targets, resolve, reject });
    });
  };
}
