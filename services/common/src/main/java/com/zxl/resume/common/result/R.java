package com.zxl.resume.common.result;

import lombok.Data;

@Data
public class R<T> {
    private int code;
    private String message;
    private T data;

    private R() {}

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.code = 200;
        r.message = "success";
        r.data = data;
        return r;
    }

    public static <T> R<T> ok() {
        return ok(null);
    }

    public static <T> R<T> fail(int code, String message) {
        R<T> r = new R<>();
        r.code = code;
        r.message = message;
        return r;
    }

    public static <T> R<T> unauthorized(String message) {
        return fail(401, message);
    }

    public static <T> R<T> badRequest(String message) {
        return fail(400, message);
    }

    public static <T> R<T> notFound(String message) {
        return fail(404, message);
    }
}
