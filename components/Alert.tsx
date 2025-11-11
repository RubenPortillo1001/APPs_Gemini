import React from 'react';

interface AlertProps {
    type: 'danger' | 'warning' | 'info';
    title: string;
    children: React.ReactNode;
}

const Alert: React.FC<AlertProps> = ({ type, title, children }) => {
    const baseClasses = 'border-l-4 p-4 rounded-r-lg';
    const typeClasses = {
        danger: 'bg-danger-bg border-danger-border text-danger-text',
        warning: 'bg-warning-bg border-warning-border text-warning-text',
        info: 'bg-blue-100 border-blue-500 text-blue-700',
    };

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
            <p className="font-bold">{title}</p>
            <div className="text-sm">{children}</div>
        </div>
    );
};

export default Alert;
