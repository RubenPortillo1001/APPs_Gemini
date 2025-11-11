import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`bg-white rounded-lg shadow-md p-4 md:p-6 ${className}`}>
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">{title}</h3>
            {children}
        </div>
    );
};

export default Card;
