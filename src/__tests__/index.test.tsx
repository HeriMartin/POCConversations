import "..";
import { Provider } from "react-redux";
import * as reactDom from "react-dom";

import { sessionDataHandler } from "../sessionDataHandler";
import { WebchatWidget } from "../components/WebchatWidget";
import { store } from "../store/store";
import * as logger from "../logger";
import * as initActions from "../store/actions/initActions";

jest.mock("react-dom");

store.dispatch = jest.fn();

describe("Index", () => {
    const { initWebchat } = window.Twilio;

    describe("initWebchat", () => {
        it("renders Webchat Lite correctly", () => {
            const renderSpy = jest.spyOn(reactDom, "render");

            const root = document.createElement("div");
            root.id = "twilio-webchat-widget-root";
            document.body.appendChild(root);
            initWebchat({ deploymentKey: "xyz" });

            expect(renderSpy).toBeCalledWith(
                <Provider store={store}>
                    <WebchatWidget />
                </Provider>,
                root
            );
        });

        it("sets region correctly", () => {
            const setRegionSpy = jest.spyOn(sessionDataHandler, "setRegion");

            const region = "Foo";
            initWebchat({ deploymentKey: "xyz", region });

            expect(setRegionSpy).toBeCalledWith(region);
        });

        it("sets deployment key correctly", () => {
            const setDeploymentKeySpy = jest.spyOn(sessionDataHandler, "setDeploymentKey");

            const deploymentKey = "Foo";
            initWebchat({ deploymentKey });

            expect(setDeploymentKeySpy).toBeCalledWith(deploymentKey);
        });

        it("initializes config", () => {
            const initConfigSpy = jest.spyOn(initActions, "initConfig");

            initWebchat({ deploymentKey: "xyz" });

            expect(initConfigSpy).toBeCalled();
        });

        it("gives error when deploymentKey is missing", () => {
            const errorLoggerSpy = jest.spyOn(console, "error");
            initWebchat();
            expect(errorLoggerSpy).toHaveBeenCalledWith("`deploymentKey` is required.");
        });

        it("gives warning when unsupported params are passed", () => {
            const warningSpy = jest.spyOn(console, "warn");
            initWebchat({ deploymentKey: "xyz", someKey: "abc" });
            expect(warningSpy).toHaveBeenCalledWith("someKey is not supported.");
        });

        it("initializes config with provided config merged with default config", () => {
            const initConfigSpy = jest.spyOn(initActions, "initConfig");

            const deploymentKey = "DKxxxxxxxxxxxx";
            initWebchat({ deploymentKey });

            expect(initConfigSpy).toBeCalledWith(expect.objectContaining({ deploymentKey, theme: { isLight: true } }));
        });

        it("initializes logger", () => {
            const initLoggerSpy = jest.spyOn(logger, "initLogger");

            initWebchat({ deploymentKey: "xyz" });

            expect(initLoggerSpy).toBeCalled();
        });
    });
});
