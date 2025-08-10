import React, { createContext, useContext, useEffect, useState } from 'react';

const RouterContext = createContext({ path: '/', navigate: () => {}, base: '' });
const OutletContext = createContext(null);

function stripBase(path, base) {
    if (base && path.startsWith(base)) {
        const stripped = path.slice(base.length);
        return stripped.startsWith('/') ? stripped : '/' + stripped;
    }
    return path;
}

export function BrowserRouter({ children }) {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
    const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;

    const [path, setPath] = useState(stripBase(window.location.pathname || '/', baseNoSlash));

    useEffect(() => {
        const onPopState = () => setPath(stripBase(window.location.pathname || '/', baseNoSlash));
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [baseNoSlash]);

    const navigate = (to) => {
        window.history.pushState({}, '', `${baseNoSlash}${to}`);
        setPath(to);
    };

    return (
        <RouterContext.Provider value={{ path, navigate, base: baseNoSlash }}>
            {children}
        </RouterContext.Provider>
    );
}

function matchRoutes(children, path) {
    const routes = React.Children.toArray(children);
    for (const route of routes) {
        if (!React.isValidElement(route)) continue;
        const { path: routePath = '', element, index, children: childRoutes } = route.props;
        const fullRoute = routePath.startsWith('/') ? routePath : '/' + routePath;
        const isRoot = fullRoute === '/';
        const match =
            (index && (path === '/' || path === '')) ||
            isRoot ||
            path === fullRoute ||
            path.startsWith(fullRoute + '/');

        if (match) {
            let rest;
            if (index) {
                rest = '/';
            } else if (isRoot) {
                rest = path.slice(1);
                rest = rest.length === 0 ? '/' : '/' + rest;
            } else {
                rest = path.slice(fullRoute.length);
                rest = rest.length === 0 ? '/' : rest;
            }
            const childElement = childRoutes ? matchRoutes(childRoutes, rest) : null;
            return (
                <OutletContext.Provider value={childElement}>
                    {element}
                </OutletContext.Provider>
            );
        }
    }
    return null;
}

export function Routes({ children }) {
    const { path } = useContext(RouterContext);
    return matchRoutes(children, path);
}

export function Route() {
    return null;
}

export function Outlet() {
    return useContext(OutletContext);
}

export function NavLink({ to, children, className }) {
    const { path, navigate, base } = useContext(RouterContext);
    const isActive = path === to;
    const cls = typeof className === 'function' ? className({ isActive }) : className;
    return (
        <a
            href={`${base}${to}`}
            className={cls}
            onClick={(e) => {
                e.preventDefault();
                navigate(to);
            }}
        >
            {children}
        </a>
    );
}

export function Sidebar() {
    return null;
}
