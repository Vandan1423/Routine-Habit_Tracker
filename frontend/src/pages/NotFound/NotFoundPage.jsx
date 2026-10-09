import { Link } from "react-router-dom";
import { HOME_PATH } from "../../components/shell/navigation";
import Page from "../../components/shell/Page";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import useDocumentTitle from "../../hooks/useDocumentTitle";

export const NOT_FOUND_TITLE = "Page not found";

/**
 * Shown for an address that leads nowhere.
 * standalone: on its own, for a visitor who is not signed in. Otherwise it sits inside the shell,
 *             which names the browser tab itself.
 */
const NotFoundPage = ({ standalone = false }) => {
    useDocumentTitle(standalone ? NOT_FOUND_TITLE : undefined);

    return (
        <Page standalone={standalone}>
            <EmptyState
                as="h1"
                title="There’s nothing at this address"
                actions={
                    <Button as={Link} to={standalone ? "/login" : HOME_PATH} variant="primary">
                        {standalone ? "Go to sign in" : "Go to Today"}
                    </Button>
                }
            >
                The link may be out of date, or the address may have been mistyped.
            </EmptyState>
        </Page>
    );
};

export default NotFoundPage;
