interface ChatRoomSelectorProps {
  selectedRoom: string
  onSelectRoom: (room: string) => void
  currentRooms: string[]
  unreadCounts?: Map<string, number>
}

const AVAILABLE_ROOMS = [
  { id: "general", name: "General", description: "General discussion" },
  { id: "random", name: "Random", description: "Random chatter" },
  { id: "tech", name: "Tech", description: "Tech talk" },
  { id: "gaming", name: "Gaming", description: "Gaming discussion" },
  { id: "music", name: "Music", description: "Music lovers" },
]

export function ChatRoomSelector({
  selectedRoom,
  onSelectRoom,
  currentRooms,
  unreadCounts,
}: ChatRoomSelectorProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-1">
        {AVAILABLE_ROOMS.map((room) => {
          const isSelected = selectedRoom === room.id
          const isJoined = currentRooms.includes(room.id)
          const unreadCount = unreadCounts?.get(room.id) || 0

          return (
            <button
              type="button"
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                isSelected
                  ? "bg-[#ff73a8] text-white"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">#</span>
                  <div>
                    <div className="font-medium">{room.name}</div>
                    <div
                      className={`text-xs ${
                        isSelected ? "text-pink-100" : "text-gray-500"
                      }`}
                    >
                      {room.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && !isSelected && (
                    <div className="bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </div>
                  )}
                  {isJoined && (
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? "bg-white" : "bg-green-500"
                      }`}
                      title="Joined"
                    />
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
