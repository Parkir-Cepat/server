import { roomResolvers } from "../../../schemas/resolvers/roomResolvers.js";
import { Room } from "../../../models/Room.js";
import { UserRoom } from "../../../models/UserRoom.js";
import { User } from "../../../models/User.js";
import { GraphQLError } from "graphql";

// Mock the models
jest.mock("../../../models/Room.js");
jest.mock("../../../models/UserRoom.js");
jest.mock("../../../models/User.js");

describe("Room Resolvers", () => {
  let mockUser;
  let mockRoom;
  let mockUserRoom;
  let mockParticipant;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      _id: "507f1f77bcf86cd799439011",
      id: "507f1f77bcf86cd799439011",
      name: "Test User",
      email: "test@example.com",
      role: "user"
    };

    mockRoom = {
      _id: "507f1f77bcf86cd799439012",
      id: "507f1f77bcf86cd799439012",
      nameRoom: "Test Room",
      type: "general",
      privacy: "public",
      creator_id: "507f1f77bcf86cd799439011",
      max_participants: 10,
      parking_id: "507f1f77bcf86cd799439013"
    };

    mockUserRoom = {
      _id: "507f1f77bcf86cd799439014",
      user_id: "507f1f77bcf86cd799439011",
      room_id: "507f1f77bcf86cd799439012",
      role: "member"
    };

    mockParticipant = {
      _id: "507f1f77bcf86cd799439015",
      id: "507f1f77bcf86cd799439015",
      name: "Participant User",
      email: "participant@example.com"
    };
  });

  describe("Room Field Resolvers", () => {
    describe("name", () => {
      it("should return room nameRoom", () => {
        const result = roomResolvers.Room.name(mockRoom);
        expect(result).toBe("Test Room");
      });

      it("should return default name when nameRoom is null", () => {
        const room = { ...mockRoom, nameRoom: null };
        const result = roomResolvers.Room.name(room);
        expect(result).toBe("General Chat");
      });
    });

    describe("type", () => {
      it("should return room type", () => {
        const result = roomResolvers.Room.type(mockRoom);
        expect(result).toBe("general");
      });

      it("should return default type when type is null", () => {
        const room = { ...mockRoom, type: null };
        const result = roomResolvers.Room.type(room);
        expect(result).toBe("general");
      });
    });

    describe("privacy", () => {
      it("should return room privacy", () => {
        const result = roomResolvers.Room.privacy(mockRoom);
        expect(result).toBe("public");
      });

      it("should return default privacy when privacy is null", () => {
        const room = { ...mockRoom, privacy: null };
        const result = roomResolvers.Room.privacy(room);
        expect(result).toBe("public");
      });
    });

    describe("creator", () => {
      it("should return creator user", async () => {
        User.findById.mockResolvedValue(mockUser);

        const result = await roomResolvers.Room.creator(mockRoom);

        expect(User.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
        expect(result).toEqual(mockUser);
      });

      it("should return null when creator_id is null", async () => {
        const room = { ...mockRoom, creator_id: null };
        const result = await roomResolvers.Room.creator(room);
        expect(result).toBeNull();
      });
    });

    describe("is_full", () => {
      it("should return false when no max_participants", async () => {
        const room = { ...mockRoom, max_participants: null };
        const result = await roomResolvers.Room.is_full(room);
        expect(result).toBe(false);
      });

      it("should return true when room is full", async () => {
        UserRoom.countByRoom.mockResolvedValue(10);

        const result = await roomResolvers.Room.is_full(mockRoom);

        expect(UserRoom.countByRoom).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(result).toBe(true);
      });

      it("should return false when room is not full", async () => {
        UserRoom.countByRoom.mockResolvedValue(5);

        const result = await roomResolvers.Room.is_full(mockRoom);

        expect(UserRoom.countByRoom).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(result).toBe(false);
      });
    });

    describe("participants", () => {
      it("should return list of participants", async () => {
        const mockUserRooms = [
          { user_id: "507f1f77bcf86cd799439011" },
          { user_id: "507f1f77bcf86cd799439015" }
        ];
        UserRoom.findByRoomId.mockResolvedValue(mockUserRooms);
        User.findByIds.mockResolvedValue([mockUser, mockParticipant]);

        const result = await roomResolvers.Room.participants(mockRoom);

        expect(UserRoom.findByRoomId).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(User.findByIds).toHaveBeenCalledWith(["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439015"]);
        expect(result).toEqual([mockUser, mockParticipant]);
      });
    });

    describe("participant_count", () => {
      it("should return participant count", async () => {
        UserRoom.countByRoom.mockResolvedValue(5);

        const result = await roomResolvers.Room.participant_count(mockRoom);

        expect(UserRoom.countByRoom).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(result).toBe(5);
      });
    });
  });

  describe("Query Resolvers", () => {
    describe("getRoom", () => {
      it("should return room when user has access", async () => {
        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);

        const result = await roomResolvers.Query.getRoom(
          null,
          { id: "507f1f77bcf86cd799439012" },
          { user: mockUser }
        );

        expect(Room.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(UserRoom.findByUserAndRoom).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
          "507f1f77bcf86cd799439012"
        );
        expect(result).toEqual(mockRoom);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Query.getRoom(null, { id: "507f1f77bcf86cd799439012" }, {})
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when room not found", async () => {
        Room.findById.mockResolvedValue(null);

        await expect(
          roomResolvers.Query.getRoom(
            null,
            { id: "507f1f77bcf86cd799439012" },
            { user: mockUser }
          )
        ).rejects.toThrow("Room tidak ditemukan");
      });

      it("should throw error when user has no access to room", async () => {
        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(null);

        await expect(
          roomResolvers.Query.getRoom(
            null,
            { id: "507f1f77bcf86cd799439012" },
            { user: mockUser }
          )
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("getMyRooms", () => {
      it("should return user's rooms", async () => {
        const mockUserRooms = [{ room_id: "507f1f77bcf86cd799439012" }];
        UserRoom.findByUserId.mockResolvedValue(mockUserRooms);
        Room.findByIds.mockResolvedValue([mockRoom]);

        const result = await roomResolvers.Query.getMyRooms(null, {}, { user: mockUser });

        expect(UserRoom.findByUserId).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
        expect(Room.findByIds).toHaveBeenCalledWith(["507f1f77bcf86cd799439012"]);
        expect(result).toEqual([mockRoom]);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Query.getMyRooms(null, {}, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("getPublicRooms", () => {
      it("should return public rooms", async () => {
        Room.findPublicRooms.mockResolvedValue([mockRoom]);

        const result = await roomResolvers.Query.getPublicRooms(
          null,
          { limit: 10, parking_id: "507f1f77bcf86cd799439013" },
          { user: mockUser }
        );

        expect(Room.findPublicRooms).toHaveBeenCalledWith(10, "507f1f77bcf86cd799439013");
        expect(result).toEqual([mockRoom]);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Query.getPublicRooms(null, {}, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("getPrivateRoomWithUser", () => {
      it("should return private room between users", async () => {
        Room.findPrivateRoomBetweenUsers.mockResolvedValue(mockRoom);

        const result = await roomResolvers.Query.getPrivateRoomWithUser(
          null,
          { user_id: "507f1f77bcf86cd799439015", parking_id: "507f1f77bcf86cd799439013" },
          { user: mockUser }
        );

        expect(Room.findPrivateRoomBetweenUsers).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
          "507f1f77bcf86cd799439015",
          "507f1f77bcf86cd799439013"
        );
        expect(result).toEqual(mockRoom);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Query.getPrivateRoomWithUser(null, {}, {})
        ).rejects.toThrow(GraphQLError);
      });
    });
  });

  describe("Mutation Resolvers", () => {
    describe("createRoom", () => {
      it("should create room with participants", async () => {
        const input = {
          nameRoom: "New Room",
          type: "general",
          privacy: "public",
          max_participants: 10,
          parking_id: "507f1f77bcf86cd799439013",
          participant_ids: ["507f1f77bcf86cd799439015"]
        };

        Room.create.mockResolvedValue(mockRoom);
        UserRoom.create.mockResolvedValue(mockUserRoom);
        User.findById.mockResolvedValue(mockParticipant);

        const result = await roomResolvers.Mutation.createRoom(
          null,
          { input },
          { user: mockUser }
        );

        expect(Room.create).toHaveBeenCalledWith({
          nameRoom: "New Room",
          type: "general",
          privacy: "public",
          creator_id: "507f1f77bcf86cd799439011",
          max_participants: 10,
          parking_id: "507f1f77bcf86cd799439013"
        });
        
        expect(UserRoom.create).toHaveBeenCalledWith({
          user_id: "507f1f77bcf86cd799439011",
          room_id: "507f1f77bcf86cd799439012"
        });

        expect(UserRoom.create).toHaveBeenCalledWith({
          user_id: "507f1f77bcf86cd799439015",
          room_id: "507f1f77bcf86cd799439012"
        });

        expect(result).toEqual(mockRoom);
      });

      it("should create room using name field when nameRoom is not provided", async () => {
        const input = {
          name: "Named Room",
          type: "general"
        };

        Room.create.mockResolvedValue(mockRoom);
        UserRoom.create.mockResolvedValue(mockUserRoom);

        await roomResolvers.Mutation.createRoom(null, { input }, { user: mockUser });

        expect(Room.create).toHaveBeenCalledWith(expect.objectContaining({
          nameRoom: "Named Room"
        }));
      });

      it("should skip invalid participants", async () => {
        const input = {
          nameRoom: "New Room",
          participant_ids: ["507f1f77bcf86cd799439015", "invalid_id"]
        };

        Room.create.mockResolvedValue(mockRoom);
        UserRoom.create.mockResolvedValue(mockUserRoom);
        User.findById.mockImplementation((id) => {
          if (id === "507f1f77bcf86cd799439015") return Promise.resolve(mockParticipant);
          return Promise.resolve(null);
        });

        await roomResolvers.Mutation.createRoom(null, { input }, { user: mockUser });

        expect(UserRoom.create).toHaveBeenCalledTimes(2); // Creator + 1 valid participant
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Mutation.createRoom(null, { input: {} }, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("createPrivateRoom", () => {
      it("should create new private room", async () => {
        const input = {
          participant_id: "507f1f77bcf86cd799439015",
          parking_id: "507f1f77bcf86cd799439013"
        };

        Room.findPrivateRoomBetweenUsers.mockResolvedValue(null);
        User.findById.mockResolvedValue(mockParticipant);
        Room.create.mockResolvedValue(mockRoom);
        UserRoom.create.mockResolvedValue(mockUserRoom);

        const result = await roomResolvers.Mutation.createPrivateRoom(
          null,
          { input },
          { user: mockUser }
        );

        expect(Room.findPrivateRoomBetweenUsers).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
          "507f1f77bcf86cd799439015",
          "507f1f77bcf86cd799439013"
        );

        expect(Room.create).toHaveBeenCalledWith({
          nameRoom: "Chat with Participant User",
          type: "direct",
          privacy: "private",
          creator_id: "507f1f77bcf86cd799439011",
          max_participants: 2,
          parking_id: "507f1f77bcf86cd799439013"
        });

        expect(UserRoom.create).toHaveBeenCalledWith({
          user_id: "507f1f77bcf86cd799439011",
          room_id: "507f1f77bcf86cd799439012",
          role: "admin"
        });

        expect(UserRoom.create).toHaveBeenCalledWith({
          user_id: "507f1f77bcf86cd799439015",
          room_id: "507f1f77bcf86cd799439012",
          role: "member"
        });

        expect(result).toEqual(mockRoom);
      });

      it("should return existing private room", async () => {
        const input = {
          participant_id: "507f1f77bcf86cd799439015",
          parking_id: "507f1f77bcf86cd799439013"
        };

        Room.findPrivateRoomBetweenUsers.mockResolvedValue(mockRoom);

        const result = await roomResolvers.Mutation.createPrivateRoom(
          null,
          { input },
          { user: mockUser }
        );

        expect(result).toEqual(mockRoom);
        expect(Room.create).not.toHaveBeenCalled();
      });

      it("should throw error when participant not found", async () => {
        const input = {
          participant_id: "507f1f77bcf86cd799439015",
          parking_id: "507f1f77bcf86cd799439013"
        };

        Room.findPrivateRoomBetweenUsers.mockResolvedValue(null);
        User.findById.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.createPrivateRoom(null, { input }, { user: mockUser })
        ).rejects.toThrow("User tidak ditemukan");
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Mutation.createPrivateRoom(null, { input: {} }, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("joinRoom", () => {
      it("should join public room successfully", async () => {
        const input = { room_id: "507f1f77bcf86cd799439012" };

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(null);
        UserRoom.countByRoom.mockResolvedValue(5);
        UserRoom.create.mockResolvedValue(mockUserRoom);

        const result = await roomResolvers.Mutation.joinRoom(
          null,
          { input },
          { user: mockUser }
        );

        expect(Room.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(UserRoom.create).toHaveBeenCalledWith({
          user_id: "507f1f77bcf86cd799439011",
          room_id: "507f1f77bcf86cd799439012",
          role: "member"
        });
        expect(result).toEqual(mockRoom);
      });

      it("should return room if user is already a member", async () => {
        const input = { room_id: "507f1f77bcf86cd799439012" };

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);

        const result = await roomResolvers.Mutation.joinRoom(
          null,
          { input },
          { user: mockUser }
        );

        expect(UserRoom.create).not.toHaveBeenCalled();
        expect(result).toEqual(mockRoom);
      });

      it("should throw error when room not found", async () => {
        const input = { room_id: "507f1f77bcf86cd799439012" };
        Room.findById.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.joinRoom(null, { input }, { user: mockUser })
        ).rejects.toThrow("Room tidak ditemukan");
      });

      it("should throw error when trying to join private room", async () => {
        const input = { room_id: "507f1f77bcf86cd799439012" };
        const privateRoom = { ...mockRoom, privacy: "private" };

        Room.findById.mockResolvedValue(privateRoom);

        await expect(
          roomResolvers.Mutation.joinRoom(null, { input }, { user: mockUser })
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when room is full", async () => {
        const input = { room_id: "507f1f77bcf86cd799439012" };

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(null);
        UserRoom.countByRoom.mockResolvedValue(10);

        await expect(
          roomResolvers.Mutation.joinRoom(null, { input }, { user: mockUser })
        ).rejects.toThrow("Room sudah penuh");
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Mutation.joinRoom(null, { input: {} }, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("updateRoom", () => {
      it("should update room when user has access", async () => {
        const input = { nameRoom: "Updated Room" };
        const updatedRoom = { ...mockRoom, nameRoom: "Updated Room" };

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);
        Room.update.mockResolvedValue(updatedRoom);

        const result = await roomResolvers.Mutation.updateRoom(
          null,
          { id: "507f1f77bcf86cd799439012", input },
          { user: mockUser }
        );

        expect(Room.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(Room.update).toHaveBeenCalledWith("507f1f77bcf86cd799439012", input);
        expect(result).toEqual(updatedRoom);
      });

      it("should throw error when room not found", async () => {
        Room.findById.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.updateRoom(
            null,
            { id: "507f1f77bcf86cd799439012", input: {} },
            { user: mockUser }
          )
        ).rejects.toThrow("Room tidak ditemukan");
      });

      it("should throw error when user has no access", async () => {
        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.updateRoom(
            null,
            { id: "507f1f77bcf86cd799439012", input: {} },
            { user: mockUser }
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Mutation.updateRoom(null, { id: "123", input: {} }, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("addParticipants", () => {
      it("should add participants to room", async () => {
        const participant_ids = ["507f1f77bcf86cd799439015", "507f1f77bcf86cd799439016"];

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockImplementation((userId, roomId) => {
          if (userId === "507f1f77bcf86cd799439011") return Promise.resolve(mockUserRoom);
          return Promise.resolve(null);
        });
        User.findById.mockResolvedValue(mockParticipant);
        UserRoom.create.mockResolvedValue(mockUserRoom);

        const result = await roomResolvers.Mutation.addParticipants(
          null,
          { room_id: "507f1f77bcf86cd799439012", participant_ids },
          { user: mockUser }
        );

        expect(User.findById).toHaveBeenCalledTimes(2);
        expect(UserRoom.create).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockRoom);
      });

      it("should skip existing participants", async () => {
        const participant_ids = ["507f1f77bcf86cd799439015"];

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);
        User.findById.mockResolvedValue(mockParticipant);

        const result = await roomResolvers.Mutation.addParticipants(
          null,
          { room_id: "507f1f77bcf86cd799439012", participant_ids },
          { user: mockUser }
        );

        expect(UserRoom.create).not.toHaveBeenCalled();
        expect(result).toEqual(mockRoom);
      });

      it("should throw error when participant not found", async () => {
        const participant_ids = ["507f1f77bcf86cd799439015"];

        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);
        User.findById.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.addParticipants(
            null,
            { room_id: "507f1f77bcf86cd799439012", participant_ids },
            { user: mockUser }
          )
        ).rejects.toThrow("User dengan ID 507f1f77bcf86cd799439015 tidak ditemukan");
      });

      it("should throw error when room not found", async () => {
        Room.findById.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.addParticipants(
            null,
            { room_id: "507f1f77bcf86cd799439012", participant_ids: [] },
            { user: mockUser }
          )
        ).rejects.toThrow("Room tidak ditemukan");
      });

      it("should throw error when user has no access", async () => {
        Room.findById.mockResolvedValue(mockRoom);
        UserRoom.findByUserAndRoom.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.addParticipants(
            null,
            { room_id: "507f1f77bcf86cd799439012", participant_ids: [] },
            { user: mockUser }
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Mutation.addParticipants(null, { room_id: "123", participant_ids: [] }, {})
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("removeParticipant", () => {
    });

    describe("deleteRoom", () => {
    });

    describe("leaveRoom", () => {
      it("should leave room successfully", async () => {
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);
        UserRoom.delete.mockResolvedValue(true);
        UserRoom.countByRoom.mockResolvedValue(1);

        const result = await roomResolvers.Mutation.leaveRoom(
          null,
          { room_id: "507f1f77bcf86cd799439012" },
          { user: mockUser }
        );

        expect(UserRoom.delete).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
          "507f1f77bcf86cd799439012"
        );
        expect(result).toBe(true);
      });

      it("should delete room when no participants left", async () => {
        UserRoom.findByUserAndRoom.mockResolvedValue(mockUserRoom);
        UserRoom.delete.mockResolvedValue(true);
        UserRoom.countByRoom.mockResolvedValue(0);
        Room.delete.mockResolvedValue(true);

        const result = await roomResolvers.Mutation.leaveRoom(
          null,
          { room_id: "507f1f77bcf86cd799439012" },
          { user: mockUser }
        );

        expect(Room.delete).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
        expect(result).toBe(true);
      });

      it("should throw error when user has no access to room", async () => {
        UserRoom.findByUserAndRoom.mockResolvedValue(null);

        await expect(
          roomResolvers.Mutation.leaveRoom(
            null,
            { room_id: "507f1f77bcf86cd799439012" },
            { user: mockUser }
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when user is not authenticated", async () => {
        await expect(
          roomResolvers.Mutation.leaveRoom(null, { room_id: "123" }, {})
        ).rejects.toThrow(GraphQLError);
      });

      it("should handle database errors gracefully", async () => {
        UserRoom.findByUserAndRoom.mockRejectedValue(new Error("Database error"));

        await expect(
          roomResolvers.Mutation.leaveRoom(
            null,
            { room_id: "507f1f77bcf86cd799439012" },
            { user: mockUser }
          )
        ).rejects.toThrow(GraphQLError);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors in field resolvers", async () => {
      User.findById.mockRejectedValue(new Error("Database error"));

      await expect(
        roomResolvers.Room.creator(mockRoom)
      ).rejects.toThrow("Database error");
    });

    it("should handle database errors in query resolvers", async () => {
      Room.findById.mockRejectedValue(new Error("Database error"));

      await expect(
        roomResolvers.Query.getRoom(
          null,
          { id: "507f1f77bcf86cd799439012" },
          { user: mockUser }
        )
      ).rejects.toThrow("Database error");
    });

    it("should handle database errors in mutation resolvers", async () => {
      Room.create.mockRejectedValue(new Error("Database error"));

      await expect(
        roomResolvers.Mutation.createRoom(
          null,
          { input: { nameRoom: "Test" } },
          { user: mockUser }
        )
      ).rejects.toThrow("Database error");
    });
  });
});
