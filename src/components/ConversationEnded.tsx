import log from "loglevel";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Box } from "@twilio-paste/core/box";
import { Flex } from "@twilio-paste/core/flex";
import { Text } from "@twilio-paste/core/text";
import { Button } from "@twilio-paste/core/button";
import CircularProgress from "@mui/material/CircularProgress";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import slugify from "slugify";

import { sessionDataHandler, contactBackend } from "../sessionDataHandler";
import { changeEngagementPhase, updatePreEngagementData } from "../store/actions/genericActions";
import { EngagementPhase, AppState } from "../store/definitions";
import { containerStyles, textStyles, titleStyles } from "./styles/ConversationEnded.styles";
import {
    getTranscriptData,
    getAgentNames,
    generateDownloadTranscript,
    getUniqueFilenames,
    generateEmailTranscript
} from "./GenerateTranscripts";
import { ProgressContainer, ButtonContainer } from "./ConversationEnded.components";

export const ConversationEnded = () => {
    const dispatch = useDispatch();
    const { messages, users, preEngagementData, transcriptConfig } = useSelector((state: AppState) => ({
        messages: state.chat.messages,
        users: state.chat.users,
        preEngagementData: state.chat.conversation?.attributes.pre_engagement_data,
        transcriptConfig: state.config.transcript
    }));

    const [downloadingTranscriptProgress, setdownloadingTranscriptProgress] = useState(0);
    const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
    const [isDownloadingTranscript, setIsDownloadingTranscript] = useState(false);
    const [emailingTranscript, setEmailingTranscript] = useState(false);

    const handleStartNewChat = () => {
        sessionDataHandler.clear();
        dispatch(updatePreEngagementData({ email: "", name: "", query: "" }));
        dispatch(changeEngagementPhase({ phase: EngagementPhase.PreEngagementForm }));
    };

    const getMediaInfo = async () => {
        const mediaMessages = messages?.filter((message) => message.attachedMedia);
        const mediaInfo = [];
        for (const message of mediaMessages || []) {
            for (const media of message.attachedMedia || []) {
                try {
                    const file = {
                        name: media.filename,
                        type: media.contentType,
                        size: media.size
                    } as File;
                    const url = media ? await media.getContentTemporaryUrl() : URL.createObjectURL(file);
                    mediaInfo.push({ url, filename: media.filename, type: media.contentType });
                } catch (e) {
                    log.error(`Failed downloading message attachment: ${e}`);
                }
            }
        }
        return mediaInfo;
    };

    const handleDownloadTranscript = async () => {
        setIsDownloadingTranscript(true);
        setIsGeneratingTranscript(true);
        setdownloadingTranscriptProgress(10);
        const transcriptData = getTranscriptData(messages, users);
        const customerName = preEngagementData?.name || transcriptData[0].author?.trim();
        const agentNames = getAgentNames(customerName, transcriptData);
        const transcript = generateDownloadTranscript(customerName, agentNames, transcriptData);
        setdownloadingTranscriptProgress(25);
        const transcriptBlob = new Blob([transcript], { type: "text/plain" });
        const mediaInfo = await getMediaInfo();
        setdownloadingTranscriptProgress(50);

        let fileName = `chat-with-${customerName}`;
        if (agentNames.length > 0) {
            agentNames.forEach((name) => (fileName = fileName.concat(`-and-${name}`)));
        }
        fileName = fileName.concat(`-${slugify(transcriptData[0].timeStamp.toDateString())}`);
        fileName = fileName.toLowerCase();
        setIsGeneratingTranscript(false);
        setdownloadingTranscriptProgress(75);
        if (mediaInfo.length > 0) {
            const uniqueFilenames = getUniqueFilenames(transcriptData);
            let mediaMessageIndex = 0;
            const zip = new JSZip();
            const folder = zip.folder(fileName);
            folder?.file(`${fileName}.txt`, transcriptBlob);
            mediaInfo.forEach((info) => {
                const blobPromise = fetch(info.url).then(async (response) => {
                    if (response.status === 200) return response.blob();
                    return Promise.reject(new Error(response.statusText));
                });
                folder?.file(uniqueFilenames[mediaMessageIndex], blobPromise);
                mediaMessageIndex += 1;
            });
            zip.generateAsync({ type: "blob" })
                .then((blob) => saveAs(blob, `${fileName}.zip`))
                .catch((e) => log.error(`Failed zipping message attachments: ${e}`));
        } else {
            saveAs(transcriptBlob, `${fileName}.txt`);
        }
        setdownloadingTranscriptProgress(100);
        setTimeout(() => setIsDownloadingTranscript(false), 1000);
    };

    const handleEmailTranscript = async () => {
        setEmailingTranscript(true);
        if (preEngagementData) {
            const transcriptData = getTranscriptData(messages, users);
            const uniqueFilenames = getUniqueFilenames(transcriptData);
            const customerName = preEngagementData?.name || transcriptData[0].author?.trim();
            const agentNames = getAgentNames(customerName, transcriptData);
            const mediaInfo = await getMediaInfo();
            const transcript = generateEmailTranscript(customerName, agentNames, transcriptData);
            await contactBackend("/email", {
                recipientAddress: preEngagementData.email,
                subject: transcriptConfig?.emailSubject?.(agentNames),
                text: transcriptConfig?.emailContent?.(customerName, transcript),
                mediaInfo,
                uniqueFilenames
            });
        }
        setEmailingTranscript(false);
    };

    const renderDownloadingButton = () => {
        return (
            <Button variant="secondary" data-test="download-transcript-button" onClick={handleDownloadTranscript}>
                {isDownloadingTranscript ? (
                    <ButtonContainer>
                        <CircularProgress size={22} variant="determinate" value={downloadingTranscriptProgress} />
                        <ProgressContainer>
                            <Text as="span" fontSize="fontSize20" lineHeight="lineHeight10">
                                {" "}
                                Download
                            </Text>
                            {isGeneratingTranscript ? (
                                <Text
                                    as="span"
                                    fontSize="fontSize10"
                                    fontWeight="fontWeightLight"
                                    color="colorTextWeak"
                                >
                                    Generating...
                                </Text>
                            ) : (
                                <Text
                                    as="span"
                                    fontSize="fontSize10"
                                    fontWeight="fontWeightLight"
                                    color="colorTextWeak"
                                >
                                    Downloading...
                                </Text>
                            )}
                        </ProgressContainer>
                    </ButtonContainer>
                ) : (
                    <span>Download</span>
                )}
            </Button>
        );

    };

    return (
        <Box {...containerStyles}>
            <Text as="h3" {...titleStyles}>
                Thanks for chatting with us!
            </Text>
            {(transcriptConfig?.downloadEnabled || transcriptConfig?.emailEnabled) && (
                <>
                    <Text as="p" {...textStyles}>
                        Do you want a transcript of our chat?
                    </Text>
                    <Flex>
                        {transcriptConfig?.downloadEnabled && renderDownloadingButton()}
                        {transcriptConfig?.emailEnabled && (
                            <Box marginLeft="space40">
                                <Button
                                    variant="secondary"
                                    data-test="email-transcript-button"
                                    onClick={handleEmailTranscript}
                                    loading={emailingTranscript}
                                >
                                    Send to my email
                                </Button>
                            </Box>
                        )}
                    </Flex>
                </>
            )}
            <Text as="p" {...textStyles}>
                If you have any more questions, feel free to reach out again.
            </Text>
            <Button variant="primary" data-test="start-new-chat-button" onClick={handleStartNewChat}>
                Start new chat
            </Button>
        </Box>
    );
};
