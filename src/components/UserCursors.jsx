/* eslint-disable no-unused-vars */
import React from 'react';

const UserCursors = ({ users }) => {
  if (!users || users.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-50">
      {users.map((user) => {
        if (!user.cursor) return null;
        
        return (
          <div
            key={user.id}
            className="absolute flex items-center"
            style={{
              left: user.cursor.x,
              top: user.cursor.y,
            }}
          >
            <div
              className="w-4 h-4 rounded-full mr-2"
              style={{
                backgroundColor: `hsl(${user.id * 73}, 80%, 50%)`,
              }}
            />
            <div
              className="text-xs font-semibold px-2 py-1 rounded-md shadow-sm whitespace-nowrap"
              style={{
                backgroundColor: `hsl(${user.id * 73}, 80%, 50%)`,
                color: 'white',
              }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserCursors;