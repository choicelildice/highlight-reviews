import { useEffect, useState } from 'react';
import { SidebarAppSDK } from '@contentful/app-sdk';
import { useSDK } from '@contentful/react-apps-toolkit';
import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Spinner,
  Button,
  Note,
} from '@contentful/f36-components';
import { css } from 'emotion';
import { AppInstallationParameters } from './ConfigScreen';

interface Annotation {
  id: string;
  type: 'task' | 'comment';
  body: string;
  fieldId: string;
  quote: string;
  author: string;
  createdAt: string;
  status?: 'active' | 'resolved';
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const Sidebar = () => {
  const sdk = useSDK<SidebarAppSDK>();
  const cma = sdk.cma;
  const entryId = sdk.ids.entry;
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const params = (sdk.parameters.installation || {}) as AppInstallationParameters;

  const load = async () => {
    setLoading(true);
    try {
      const tasks = await cma.task.getMany({ entryId, query: { limit: 50 } });
      const loaded: Annotation[] = (tasks.items || []).map((t: any) => ({
        id: t.sys.id,
        type: 'task',
        body: t.body,
        fieldId: t.sys.parentEntity?.sys?.id || '',
        quote: t.body.split('\n')[0] || '',
        author: t.sys.createdBy?.sys?.id || 'stakeholder',
        createdAt: t.sys.createdAt,
        status: t.status,
      }));
      setAnnotations(loaded);
    } catch {
      setAnnotations([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [entryId]);

  const resolve = async (id: string) => {
    try {
      await cma.task.update(
        { entryId, taskId: id },
        { status: 'resolved' } as any
      );
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a))
      );
    } catch (e) {
      sdk.notifier.error('Failed to resolve task.');
    }
  };

  const active = annotations.filter((a) => a.status !== 'resolved');
  const resolved = annotations.filter((a) => a.status === 'resolved');

  return (
    <Box padding="spacingM">
      <Flex justifyContent="space-between" alignItems="center" marginBottom="spacingM">
        <Heading as="h3" marginBottom="none">
          Highlight Reviews
        </Heading>
        <Button size="small" variant="transparent" onClick={load}>
          Refresh
        </Button>
      </Flex>

      {!params.enableTasks && !params.enableComments && (
        <Note variant="warning">
          No feedback types are enabled. Visit the app configuration to enable Tasks or
          Comments.
        </Note>
      )}

      {loading ? (
        <Flex justifyContent="center" padding="spacingL">
          <Spinner />
        </Flex>
      ) : annotations.length === 0 ? (
        <Text fontColor="gray500" fontSize="fontSizeS">
          No feedback yet on this entry. Share the preview link with a stakeholder to get
          started.
        </Text>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <Text
                fontColor="gray600"
                fontSize="fontSizeS"
                fontWeight="fontWeightMedium"
                className={css({ display: 'block', marginBottom: '8px' })}
              >
                Open ({active.length})
              </Text>
              {active.map((a) => (
                <AnnotationCard key={a.id} annotation={a} onResolve={resolve} />
              ))}
            </>
          )}
          {resolved.length > 0 && (
            <>
              <Text
                fontColor="gray500"
                fontSize="fontSizeS"
                fontWeight="fontWeightMedium"
                className={css({ display: 'block', marginTop: '16px', marginBottom: '8px' })}
              >
                Resolved ({resolved.length})
              </Text>
              {resolved.map((a) => (
                <AnnotationCard key={a.id} annotation={a} onResolve={resolve} />
              ))}
            </>
          )}
        </>
      )}
    </Box>
  );
};

const AnnotationCard = ({
  annotation,
  onResolve,
}: {
  annotation: Annotation;
  onResolve: (id: string) => void;
}) => (
  <Box
    className={css({
      border: '1px solid #e5e5e5',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '8px',
      background: annotation.status === 'resolved' ? '#fafafa' : 'white',
      opacity: annotation.status === 'resolved' ? 0.7 : 1,
    })}
  >
    <Flex justifyContent="space-between" alignItems="center" marginBottom="spacingXs">
      <Badge variant={annotation.type === 'task' ? 'primary' : 'secondary'} size="small">
        {annotation.type}
      </Badge>
      {annotation.status === 'resolved' ? (
        <Badge variant="positive" size="small">
          resolved
        </Badge>
      ) : annotation.type === 'task' ? (
        <Button size="small" variant="transparent" onClick={() => onResolve(annotation.id)}>
          Resolve
        </Button>
      ) : null}
    </Flex>

    {annotation.quote && (
      <Text
        fontColor="gray600"
        fontSize="fontSizeS"
        className={css({
          display: 'block',
          borderLeft: '3px solid #ccc',
          paddingLeft: '8px',
          marginBottom: '6px',
          fontStyle: 'italic',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}
      >
        "{annotation.quote}"
      </Text>
    )}

    <Text fontSize="fontSizeS" className={css({ display: 'block', marginBottom: '4px' })}>
      {annotation.body}
    </Text>

    <Text fontColor="gray500" fontSize="fontSizeS">
      {annotation.author} · {timeAgo(annotation.createdAt)}
    </Text>
  </Box>
);

export default Sidebar;
