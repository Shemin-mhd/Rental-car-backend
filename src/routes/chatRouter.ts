import express from "express";
import { 
    createOrGetChat, 
    getUserChats, 
    getMessages, 
    sendMessageRest, 
    markMessageSeen,
    getAllChats
} from "../controllers/chatController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

router.use(authenticate); // 🛡️ All chat routes require authentication

router.post("/create", createOrGetChat);
router.get("/user-chats", getUserChats);
router.get("/admin/all-chats", getAllChats);
router.get("/:chatId/messages", getMessages);
router.post("/send-message", sendMessageRest);
router.patch("/:chatId/message-seen", markMessageSeen);

export default router;
