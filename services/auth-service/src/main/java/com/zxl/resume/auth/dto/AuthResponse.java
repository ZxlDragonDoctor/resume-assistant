package com.zxl.resume.auth.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class AuthResponse {
    private String token;
    private String tokenType = "Bearer";
    private UUID userId;
    private String name;
    private String email;
    private long expiresIn;
}
