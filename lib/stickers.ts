export interface Sticker {
    id: string
    name: string
    url: string
    keywords: string[]
}

export const STICKERS: Sticker[] = [
    {
        id: "sticker-1",
        name: "like",
        url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5c2l5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/l4KhQo2MESJkc6QbS/giphy.gif",
        keywords: ["like", "thumbsup", "bien", "ok"]
    },
    {
        id: "sticker-2",
        name: "love",
        url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5c2l5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/3oz8xSAj41dD3eFcc8/giphy.gif",
        keywords: ["love", "amor", "corazon", "heart"]
    },
    {
        id: "sticker-3",
        name: "laugh",
        url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5c2l5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/fUYhyT9IjftxrxJXcE/giphy.gif",
        keywords: ["laugh", "risa", "jaja", "lol"]
    },
    {
        id: "sticker-4",
        name: "sad",
        url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5c2l5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/7SF5scGB2AFrgsXP63/giphy.gif",
        keywords: ["sad", "triste", "llorar", "cry"]
    },
    {
        id: "sticker-5",
        name: "wow",
        url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5c2l5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/5i7umUqAOYYx26UKP/giphy.gif",
        keywords: ["wow", "sorpresa", "increible"]
    },
    {
        id: "sticker-6",
        name: "angry",
        url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5c2l5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/NTY1kHvfRWom3d3Q5/giphy.gif",
        keywords: ["angry", "enojado", "molesto"]
    }
]
