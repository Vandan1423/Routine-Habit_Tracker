import { Component } from "react";
import Page from "./Page";
import ScreenError from "./ScreenError";

/**
 * Catches an error thrown while what is inside it renders, and shows a way forward instead of a blank page.
 *
 * resetKey: when this changes (the address, say) the error is cleared and the inside is tried again
 * fallback: (error) => what to show. Without one, the screen-sized message below.
 */
class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidUpdate(previous) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    render() {
        const { error } = this.state;

        if (!error) {
            return this.props.children;
        }
        if (this.props.fallback) {
            return this.props.fallback(error);
        }
        return (
            <Page>
                <ScreenError error={error} />
            </Page>
        );
    }
}

export default ErrorBoundary;
