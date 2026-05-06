import { useCallback, useState, useEffect } from 'react';
import { ConfigAppSDK } from '@contentful/app-sdk';
import {
  Heading,
  Form,
  Paragraph,
  Flex,
  FormControl,
  Switch,
  Box,
  Text,
  Badge,
} from '@contentful/f36-components';
import { css } from 'emotion';
import { useSDK } from '@contentful/react-apps-toolkit';

export interface AppInstallationParameters {
  enableTasks: boolean;
  enableComments: boolean;
}

const defaultParameters: AppInstallationParameters = {
  enableTasks: true,
  enableComments: true,
};

const ConfigScreen = () => {
  const [parameters, setParameters] = useState<AppInstallationParameters>(defaultParameters);
  const sdk = useSDK<ConfigAppSDK>();

  const onConfigure = useCallback(async () => {
    if (!parameters.enableTasks && !parameters.enableComments) {
      sdk.notifier.error('At least one of Tasks or Comments must be enabled.');
      return false;
    }
    const currentState = await sdk.app.getCurrentState();
    return { parameters, targetState: currentState };
  }, [parameters, sdk]);

  useEffect(() => {
    sdk.app.onConfigure(() => onConfigure());
  }, [sdk, onConfigure]);

  useEffect(() => {
    (async () => {
      const currentParameters = await sdk.app.getParameters<AppInstallationParameters>();
      if (currentParameters) {
        setParameters(currentParameters);
      }
      sdk.app.setReady();
    })();
  }, [sdk]);

  const toggle = (key: keyof AppInstallationParameters) => {
    setParameters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Flex
      flexDirection="column"
      className={css({ margin: '80px auto', maxWidth: '680px' })}
    >
      <Flex alignItems="center" gap="spacingS" marginBottom="spacingM">
        <Heading marginBottom="none">Highlight Reviews</Heading>
        <Badge variant="primary">Configuration</Badge>
      </Flex>
      <Paragraph>
        Highlight Reviews lets stakeholders annotate your preview site by selecting text and
        leaving feedback — without needing a Contentful login. Choose which feedback types
        you want to enable below.
      </Paragraph>

      <Box
        className={css({ borderTop: '1px solid #e5e5e5', margin: '24px 0 40px' })}
      />

      <Form>
        <Heading as="h2" marginBottom="spacingM">
          Feedback Types
        </Heading>

        <Box
          className={css({
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '20px 24px',
            marginBottom: '16px',
            background: parameters.enableTasks ? '#f9fcff' : 'white',
          })}
        >
          <FormControl>
            <Flex justifyContent="space-between" alignItems="flex-start">
              <Box>
                <FormControl.Label marginBottom="none">Tasks</FormControl.Label>
                <Text fontColor="gray500" fontSize="fontSizeS">
                  Stakeholders can create assignable, resolvable tasks linked to a specific
                  entry and field. Best for actionable feedback.
                </Text>
              </Box>
              <Switch
                id="enableTasks"
                isChecked={parameters.enableTasks}
                onChange={() => toggle('enableTasks')}
              />
            </Flex>
          </FormControl>
        </Box>

        <Box
          className={css({
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '20px 24px',
            background: parameters.enableComments ? '#f9fcff' : 'white',
          })}
        >
          <FormControl>
            <Flex justifyContent="space-between" alignItems="flex-start">
              <Box>
                <FormControl.Label marginBottom="none">Comments</FormControl.Label>
                <Text fontColor="gray500" fontSize="fontSizeS">
                  Stakeholders can add threaded comments to an entry. Best for discussion
                  and general feedback.
                </Text>
              </Box>
              <Switch
                id="enableComments"
                isChecked={parameters.enableComments}
                onChange={() => toggle('enableComments')}
              />
            </Flex>
          </FormControl>
        </Box>

        {!parameters.enableTasks && !parameters.enableComments && (
          <Text fontColor="red500" fontSize="fontSizeS" marginTop="spacingS">
            At least one feedback type must be enabled.
          </Text>
        )}
      </Form>
    </Flex>
  );
};

export default ConfigScreen;
